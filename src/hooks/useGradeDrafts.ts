import { useState, useEffect, useCallback, useRef } from 'react';

interface DraftState {
  grades: Record<string, number>;
  lastSaved: number;
}

interface UseGradeDraftsOptions {
  teacherId: string | undefined;
  subjectId: string | undefined;
  semesterId: string | undefined;
}

interface UseGradeDraftsReturn {
  draftGrades: Record<string, number>;
  setDraftGrade: (enrollmentId: string, marks: number) => void;
  clearDrafts: () => void;
  restoreDrafts: () => Record<string, number>;
  hasDrafts: boolean;
  draftStatus: 'idle' | 'saving' | 'saved';
  getDraftCount: () => number;
}

const DRAFT_PREFIX = 'ugv_grade_drafts_';
const DEBOUNCE_MS = 500;

export function useGradeDrafts({
  teacherId,
  subjectId,
  semesterId,
}: UseGradeDraftsOptions): UseGradeDraftsReturn {
  const [draftGrades, setDraftGrades] = useState<Record<string, number>>({});
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate storage key scoped to teacher + subject + semester
  const getStorageKey = useCallback(() => {
    if (!teacherId || !subjectId || !semesterId) return null;
    return `${DRAFT_PREFIX}${teacherId}_${subjectId}_${semesterId}`;
  }, [teacherId, subjectId, semesterId]);

  // Restore drafts from localStorage
  const restoreDrafts = useCallback((): Record<string, number> => {
    const key = getStorageKey();
    if (!key) return {};

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: DraftState = JSON.parse(stored);
        setDraftGrades(parsed.grades);
        return parsed.grades;
      }
    } catch (error) {
      console.error('Failed to restore grade drafts:', error);
    }
    return {};
  }, [getStorageKey]);

  // Save drafts to localStorage (debounced)
  const saveDraftsToStorage = useCallback((grades: Record<string, number>) => {
    const key = getStorageKey();
    if (!key) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setDraftStatus('saving');

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const draftState: DraftState = {
          grades,
          lastSaved: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(draftState));
        setDraftStatus('saved');

        // Clear status after a moment
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
          setDraftStatus('idle');
        }, 2000);
      } catch (error) {
        console.error('Failed to save grade drafts:', error);
        setDraftStatus('idle');
      }
    }, DEBOUNCE_MS);
  }, [getStorageKey]);

  // Set a single draft grade
  const setDraftGrade = useCallback((enrollmentId: string, marks: number) => {
    setDraftGrades(prev => {
      const updated = {
        ...prev,
        [enrollmentId]: marks,
      };
      saveDraftsToStorage(updated);
      return updated;
    });
  }, [saveDraftsToStorage]);

  // Clear all drafts for current scope
  const clearDrafts = useCallback(() => {
    const key = getStorageKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to clear grade drafts:', error);
      }
    }
    setDraftGrades({});
    setDraftStatus('idle');
  }, [getStorageKey]);

  // Get count of draft entries
  const getDraftCount = useCallback(() => {
    return Object.keys(draftGrades).filter(
      key => draftGrades[key] !== undefined && !isNaN(draftGrades[key])
    ).length;
  }, [draftGrades]);

  // Check if there are any drafts
  const hasDrafts = Object.keys(draftGrades).length > 0;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // Restore drafts when scope changes
  useEffect(() => {
    if (teacherId && subjectId && semesterId) {
      restoreDrafts();
    } else {
      setDraftGrades({});
    }
  }, [teacherId, subjectId, semesterId, restoreDrafts]);

  return {
    draftGrades,
    setDraftGrade,
    clearDrafts,
    restoreDrafts,
    hasDrafts,
    draftStatus,
    getDraftCount,
  };
}
