import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Line
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Target, Lightbulb, Star, Info } from 'lucide-react';
import { SemesterGPA, SubjectGrade } from '@/lib/supabase-types';
import { getGPAStatus, isAtAcademicRisk } from '@/lib/gpa-calculator';
import { compareSemesters } from '@/lib/semester-utils';

interface GPAInsightsProps {
  semesterData: SemesterGPA[];
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
}

export function GPAInsights({ semesterData, cgpa, totalCredits, earnedCredits }: GPAInsightsProps) {
  // Ensure CGPA never exceeds 4.0 and round to 2 decimal places
  const normalizedCGPA = Math.min(4.0, Math.round(cgpa * 100) / 100);
  const atRisk = isAtAcademicRisk(normalizedCGPA);
  const gpaStatus = getGPAStatus(normalizedCGPA);

  // Sort semester data chronologically for trend chart
  const sortedSemesterData = [...semesterData].sort((a, b) => 
    compareSemesters(a.semesterName, b.semesterName)
  );

  // Calculate GPA trend from sorted data
  const gpaTrend = sortedSemesterData.map((sem, index) => ({
    semester: sem.semesterName,
    gpa: Math.min(4.0, Math.round(sem.gpa * 100) / 100),
    cgpa: Math.min(4.0, Math.round(calculateCGPAUpTo(sortedSemesterData, index) * 100) / 100)
  }));

  // Calculate improvement/decline from sorted data
  const latestGPA = sortedSemesterData.length > 0 ? sortedSemesterData[sortedSemesterData.length - 1].gpa : 0;
  const previousGPA = sortedSemesterData.length > 1 ? sortedSemesterData[sortedSemesterData.length - 2].gpa : latestGPA;
  const gpaDiff = latestGPA - previousGPA;
  const isImproving = gpaDiff >= 0;

  // Get all completed subjects with grades
  const allSubjects = sortedSemesterData.flatMap(s => s.subjects).filter(s => s.gradePoint > 0);

  // Get Top 3 Strongest Subjects (sorted by grade point, then credits)
  const top3StrongSubjects = getTop3StrongSubjects(allSubjects);

  // Get struggling subjects (grade point < 2.0)
  const strugglingSubjects = allSubjects.filter(s => s.gradePoint < 2.0);

  // Get credit-heavy subjects with lower grades for recommendations
  const creditHeavyLowGrades = allSubjects
    .filter(s => s.credits >= 3 && s.gradePoint < 3.0)
    .sort((a, b) => b.credits - a.credits || a.gradePoint - b.gradePoint);

  // Calculate required GPA to reach target
  const targetCGPA = 3.0;
  const requiredGPAForTarget = calculateRequiredGPA(normalizedCGPA, totalCredits, targetCGPA, 18);

  // Generate personalized improvement recommendations
  const recommendations = generatePersonalizedRecommendations({
    cgpa: normalizedCGPA,
    gpaDiff,
    strugglingSubjects,
    creditHeavyLowGrades,
    latestGPA,
    previousGPA,
    hasData: allSubjects.length > 0
  });

  // Determine CGPA display status
  const cgpaDisplayStatus = getCGPADisplayStatus(normalizedCGPA);

  return (
    <div className="space-y-4">
      {/* Risk Alert */}
      {atRisk && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Academic Risk Warning</AlertTitle>
          <AlertDescription>
            Your CGPA is below the minimum requirement of 2.0. Immediate action is recommended to improve your academic standing.
          </AlertDescription>
        </Alert>
      )}

      {/* GPA Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                GPA Trend
              </CardTitle>
              <CardDescription>Your academic progress over time</CardDescription>
            </div>
            <Badge variant={isImproving ? 'default' : 'destructive'} className="flex items-center gap-1">
              {isImproving ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {gpaDiff >= 0 ? '+' : ''}{gpaDiff.toFixed(2)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {gpaTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={gpaTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" fontSize={12} />
                <YAxis domain={[0, 4]} fontSize={12} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="gpa" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary) / 0.2)" 
                  name="Semester GPA"
                />
                <Line 
                  type="monotone" 
                  dataKey="cgpa" 
                  stroke="hsl(var(--chart-2))" 
                  strokeDasharray="5 5"
                  name="CGPA"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available yet</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid - Updated */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CGPA Card with 4.0 Scale Display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{normalizedCGPA.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">/ 4.00</span>
                </div>
                <p className="text-sm text-muted-foreground">Cumulative GPA</p>
                <Badge 
                  variant="outline" 
                  className={`mt-2 ${cgpaDisplayStatus.className}`}
                >
                  {cgpaDisplayStatus.label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Target GPA Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {requiredGPAForTarget > 4.0 ? '4.00+' : requiredGPAForTarget.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">GPA needed for 3.0 CGPA</p>
                {requiredGPAForTarget > 4.0 && (
                  <p className="text-xs text-amber-600 mt-1">May require multiple semesters</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Strong Subjects Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5 text-amber-500" />
            Top Performing Subjects
          </CardTitle>
          <CardDescription>Your strongest academic areas</CardDescription>
        </CardHeader>
        <CardContent>
          {top3StrongSubjects.length > 0 ? (
            <div className="space-y-3">
              {top3StrongSubjects.map((subject, idx) => (
                <div 
                  key={`${subject.subjectCode}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{subject.subjectName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{subject.subjectCode}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getGradeBadgeClass(subject.letterGrade)}>
                    {subject.letterGrade}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Strong subjects will appear after grades are published.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Credit Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Credit Progress</CardTitle>
          <CardDescription>Towards graduation (typical: 120 credits)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Earned Credits</span>
              <span className="font-medium">{earnedCredits} / 120</span>
            </div>
            <Progress value={(earnedCredits / 120) * 100} />
            <p className="text-xs text-muted-foreground">
              {120 - earnedCredits} credits remaining for graduation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personalized Improvement Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              Improvement Insights
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Personalized recommendations based on your performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.slice(0, 3).map((recommendation, idx) => (
                <li 
                  key={idx}
                  className="flex gap-3 text-sm text-muted-foreground"
                >
                  <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-blue-500" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Get Top 3 Strongest Subjects based on grade point and credits
function getTop3StrongSubjects(subjects: SubjectGrade[]): SubjectGrade[] {
  if (subjects.length === 0) return [];
  
  // Sort by grade point (desc), then by credits (desc) for tiebreakers
  const sorted = [...subjects].sort((a, b) => {
    if (b.gradePoint !== a.gradePoint) {
      return b.gradePoint - a.gradePoint;
    }
    return b.credits - a.credits;
  });
  
  return sorted.slice(0, 3);
}

// Get grade badge styling based on letter grade
function getGradeBadgeClass(letterGrade: string): string {
  const grade = letterGrade.toUpperCase();
  if (grade.startsWith('A')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  } else if (grade.startsWith('B')) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  } else if (grade.startsWith('C')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  } else if (grade === 'D') {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  } else {
    return 'border-red-200 bg-red-50 text-red-700';
  }
}

// Get CGPA display status with appropriate styling
function getCGPADisplayStatus(cgpa: number): { label: string; className: string } {
  if (cgpa >= 4.0) {
    return { label: 'Excellent Standing', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  } else if (cgpa >= 3.5) {
    return { label: "Dean's List", className: 'border-blue-200 bg-blue-50 text-blue-700' };
  } else if (cgpa >= 3.0) {
    return { label: 'Good Standing', className: 'border-sky-200 bg-sky-50 text-sky-700' };
  } else if (cgpa >= 2.5) {
    return { label: 'Satisfactory', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  } else if (cgpa >= 2.0) {
    return { label: 'Needs Improvement', className: 'border-orange-200 bg-orange-50 text-orange-700' };
  } else {
    return { label: 'Academic Probation', className: 'border-red-200 bg-red-50 text-red-700' };
  }
}

// Generate personalized recommendations based on student data
function generatePersonalizedRecommendations(data: {
  cgpa: number;
  gpaDiff: number;
  strugglingSubjects: SubjectGrade[];
  creditHeavyLowGrades: SubjectGrade[];
  latestGPA: number;
  previousGPA: number;
  hasData: boolean;
}): string[] {
  const recommendations: string[] = [];
  
  if (!data.hasData) {
    return ['Your personalized recommendations will appear once grades are published.'];
  }

  // Credit-heavy subject recommendation
  if (data.creditHeavyLowGrades.length > 0) {
    const topSubject = data.creditHeavyLowGrades[0];
    recommendations.push(
      `Improving performance in credit-heavy subjects like ${topSubject.subjectName} (${topSubject.credits} credits) can significantly boost your CGPA.`
    );
  }

  // Trend-based recommendation
  if (data.gpaDiff > 0.1) {
    recommendations.push(
      'Your recent semester GPA improved — maintaining consistency in core subjects will help sustain this positive growth.'
    );
  } else if (data.gpaDiff < -0.1) {
    recommendations.push(
      'Your GPA showed a slight dip this semester. Consider reviewing study strategies and seeking academic support for challenging subjects.'
    );
  } else if (data.gpaDiff >= -0.1 && data.gpaDiff <= 0.1 && data.latestGPA >= 3.0) {
    recommendations.push(
      'Your performance is steady. To push your CGPA higher, focus on converting B grades to A grades in upcoming semesters.'
    );
  }

  // Struggling subjects recommendation
  if (data.strugglingSubjects.length > 0) {
    recommendations.push(
      'Focus on revisiting foundational topics from lower-grade subjects for long-term CGPA stability.'
    );
  }

  // CGPA-specific recommendation
  if (data.cgpa < 2.5 && recommendations.length < 3) {
    recommendations.push(
      'Consider meeting with an academic advisor to create a structured improvement plan for the upcoming semester.'
    );
  } else if (data.cgpa >= 3.5 && recommendations.length < 3) {
    recommendations.push(
      'Your strong academic standing positions you well for honors and scholarship opportunities. Keep up the excellent work!'
    );
  }

  // Fallback if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Continue balancing your coursework and maintain consistent study habits across all subjects.'
    );
  }

  return recommendations;
}

// Helper functions
function calculateCGPAUpTo(semesters: SemesterGPA[], upToIndex: number): number {
  const relevantSemesters = semesters.slice(0, upToIndex + 1);
  const allSubjects = relevantSemesters.flatMap(s => s.subjects);
  
  if (allSubjects.length === 0) return 0;
  
  const totalWeightedPoints = allSubjects.reduce(
    (sum, s) => sum + (s.credits * s.gradePoint), 0
  );
  const totalCredits = allSubjects.reduce(
    (sum, s) => sum + s.credits, 0
  );
  
  const cgpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : 0;
  return Math.min(4.0, cgpa);
}

function calculateRequiredGPA(
  currentCGPA: number, 
  currentCredits: number, 
  targetCGPA: number, 
  futureCredits: number
): number {
  const requiredGPA = ((targetCGPA * (currentCredits + futureCredits)) - (currentCGPA * currentCredits)) / futureCredits;
  return Math.max(0, Math.min(4, requiredGPA));
}
