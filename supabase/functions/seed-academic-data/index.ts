import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Comprehensive CSE curriculum across 8 semesters
const SEMESTER_SUBJECTS = {
  1: [
    { code: "0611-1101", name: "Computer Fundamentals", credits: 3 },
    { code: "0611-1102", name: "Computer Fundamentals Sessional", credits: 1 },
    { code: "0613-1103", name: "Structured Programming", credits: 3 },
    { code: "0613-1104", name: "Structured Programming Sessional", credits: 1 },
    { code: "0541-1101", name: "Differential and Integral Calculus", credits: 3 },
    { code: "0531-1101", name: "Chemistry", credits: 3 },
    { code: "0531-1102", name: "Chemistry Sessional", credits: 1 },
    { code: "0533-1101", name: "Physics I - Electricity, Magnetism & Properties of Matter", credits: 3 },
    { code: "0533-1102", name: "Physics I Sessional", credits: 1 },
    { code: "0222-1101", name: "History of the Emergence of Independent Bangladesh", credits: 3 },
  ],
  2: [
    { code: "0613-1201", name: "Discrete Mathematics", credits: 3 },
    { code: "0613-1203", name: "Object Oriented Programming", credits: 3 },
    { code: "0613-1204", name: "Object Oriented Programming Sessional", credits: 1 },
    { code: "0541-1201", name: "Coordinate Geometry and Vector Analysis", credits: 3 },
    { code: "0533-1201", name: "Physics II - Waves, Optics and Thermodynamics", credits: 3 },
    { code: "0533-1202", name: "Physics II Sessional", credits: 1 },
    { code: "0613-1205", name: "Electrical Circuits", credits: 3 },
    { code: "0613-1206", name: "Electrical Circuits Sessional", credits: 1 },
  ],
  3: [
    { code: "0613-2101", name: "Data Structures", credits: 3 },
    { code: "0613-2102", name: "Data Structures Sessional", credits: 1 },
    { code: "0613-2103", name: "Digital Logic Design", credits: 3 },
    { code: "0613-2104", name: "Digital Logic Design Sessional", credits: 1 },
    { code: "0541-2101", name: "Ordinary Differential Equations", credits: 3 },
    { code: "0613-2105", name: "Electronic Devices and Circuits", credits: 3 },
    { code: "0613-2106", name: "Electronic Devices Sessional", credits: 1 },
    { code: "0251-2101", name: "English Composition", credits: 3 },
  ],
  4: [
    { code: "0613-2201", name: "Algorithms", credits: 3 },
    { code: "0613-2202", name: "Algorithms Sessional", credits: 1 },
    { code: "0613-2203", name: "Computer Organization and Architecture", credits: 3 },
    { code: "0613-2204", name: "Computer Organization Sessional", credits: 1 },
    { code: "0541-2201", name: "Linear Algebra and Complex Variables", credits: 3 },
    { code: "0613-2205", name: "Theory of Computation", credits: 3 },
    { code: "0471-2201", name: "Probability and Statistics", credits: 3 },
  ],
  5: [
    { code: "0613-3101", name: "Database Management Systems", credits: 3 },
    { code: "0613-3102", name: "Database Sessional", credits: 1 },
    { code: "0613-3103", name: "Operating Systems", credits: 3 },
    { code: "0613-3104", name: "Operating Systems Sessional", credits: 1 },
    { code: "0613-3105", name: "Numerical Analysis", credits: 3 },
    { code: "0613-3106", name: "Numerical Analysis Sessional", credits: 1 },
    { code: "0613-3107", name: "Microprocessors and Microcontrollers", credits: 3 },
    { code: "0613-3108", name: "Microprocessors Sessional", credits: 1 },
  ],
  6: [
    { code: "0613-3201", name: "Software Engineering", credits: 3 },
    { code: "0613-3202", name: "Software Engineering Sessional", credits: 1 },
    { code: "0613-3203", name: "Computer Networks", credits: 3 },
    { code: "0613-3204", name: "Computer Networks Sessional", credits: 1 },
    { code: "0613-3205", name: "Artificial Intelligence", credits: 3 },
    { code: "0613-3206", name: "Artificial Intelligence Sessional", credits: 1 },
    { code: "0613-3207", name: "Compiler Design", credits: 3 },
    { code: "0613-3208", name: "Compiler Design Sessional", credits: 1 },
  ],
  7: [
    { code: "0613-4101", name: "Machine Learning", credits: 3 },
    { code: "0613-4102", name: "Machine Learning Sessional", credits: 1 },
    { code: "0613-4103", name: "Web Engineering", credits: 3 },
    { code: "0613-4104", name: "Web Engineering Sessional", credits: 1 },
    { code: "0613-4105", name: "Computer Graphics", credits: 3 },
    { code: "0613-4106", name: "Computer Graphics Sessional", credits: 1 },
    { code: "0613-4107", name: "Information Security", credits: 3 },
    { code: "0613-4108", name: "Information Security Sessional", credits: 1 },
  ],
  8: [
    { code: "0613-4201", name: "Project/Thesis I", credits: 3 },
    { code: "0613-4202", name: "Project/Thesis II", credits: 3 },
    { code: "0613-4203", name: "Cloud Computing", credits: 3 },
    { code: "0613-4204", name: "Cloud Computing Sessional", credits: 1 },
    { code: "0613-4205", name: "Natural Language Processing", credits: 3 },
    { code: "0613-4206", name: "Big Data Analytics", credits: 3 },
    { code: "0613-4207", name: "Industrial Training", credits: 2 },
  ],
};

// Define semester metadata
const SEMESTER_META = [
  { num: 1, name: "Spring 2021", start: "2021-01-01", end: "2021-06-30", locked: true },
  { num: 2, name: "Fall 2021", start: "2021-07-01", end: "2021-12-31", locked: true },
  { num: 3, name: "Spring 2022", start: "2022-01-01", end: "2022-06-30", locked: true },
  { num: 4, name: "Fall 2022", start: "2022-07-01", end: "2022-12-31", locked: true },
  { num: 5, name: "Spring 2023", start: "2023-01-01", end: "2023-06-30", locked: true },
  { num: 6, name: "Fall 2023", start: "2023-07-01", end: "2023-12-31", locked: true },
  { num: 7, name: "Spring 2024", start: "2024-01-01", end: "2024-06-30", locked: true },
  { num: 8, name: "Fall 2024", start: "2024-07-01", end: "2024-12-31", locked: false },
];

interface SeedResult {
  sessions_created: number;
  semesters_created: number;
  subjects_created: number;
  enrollments_created: number;
  teacher_assignments_created: number;
  grades_created: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if user is admin
    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result: SeedResult = {
      sessions_created: 0,
      semesters_created: 0,
      subjects_created: 0,
      enrollments_created: 0,
      teacher_assignments_created: 0,
      grades_created: 0,
      errors: []
    };

    // Get grade mappings
    const { data: gradeMappings } = await adminClient
      .from("grade_mappings")
      .select("*")
      .order("min_marks", { ascending: false });

    if (!gradeMappings || gradeMappings.length === 0) {
      return new Response(JSON.stringify({ error: "No grade mappings found. Please create grade mappings first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // =============================================
    // STEP 1: Create Academic Sessions (if needed)
    // =============================================
    const sessions = [
      { name: "2021-2022", start_date: "2021-01-01", end_date: "2022-12-31", is_active: false },
      { name: "2022-2023", start_date: "2022-01-01", end_date: "2023-12-31", is_active: false },
      { name: "2023-2024", start_date: "2023-01-01", end_date: "2024-12-31", is_active: false },
      { name: "2024-2025", start_date: "2024-01-01", end_date: "2025-12-31", is_active: true },
    ];

    const sessionMap: Record<string, string> = {};
    
    for (const session of sessions) {
      // Check if session exists
      const { data: existing } = await adminClient
        .from("academic_sessions")
        .select("id, name")
        .eq("name", session.name)
        .single();
      
      if (existing) {
        sessionMap[session.name] = existing.id;
      } else {
        const { data: newSession, error } = await adminClient
          .from("academic_sessions")
          .insert(session)
          .select("id")
          .single();
        
        if (error) {
          result.errors.push(`Failed to create session ${session.name}: ${error.message}`);
        } else if (newSession) {
          sessionMap[session.name] = newSession.id;
          result.sessions_created++;
        }
      }
    }

    console.log("Sessions created/found:", sessionMap);

    // =============================================
    // STEP 2: Create Semesters (1-8)
    // =============================================
    const semesterMap: Record<number, string> = {};
    
    // Map semester number to academic session
    const semToSession: Record<number, string> = {
      1: "2021-2022", 2: "2021-2022",
      3: "2022-2023", 4: "2022-2023",
      5: "2023-2024", 6: "2023-2024",
      7: "2024-2025", 8: "2024-2025",
    };

    for (const sem of SEMESTER_META) {
      const sessionId = sessionMap[semToSession[sem.num]];
      if (!sessionId) {
        result.errors.push(`No session found for semester ${sem.num}`);
        continue;
      }

      // Check if semester exists
      const { data: existing } = await adminClient
        .from("semesters")
        .select("id, name")
        .eq("name", sem.name)
        .single();
      
      if (existing) {
        semesterMap[sem.num] = existing.id;
      } else {
        const { data: newSem, error } = await adminClient
          .from("semesters")
          .insert({
            academic_session_id: sessionId,
            name: sem.name,
            start_date: sem.start,
            end_date: sem.end,
            is_locked: sem.locked,
          })
          .select("id")
          .single();
        
        if (error) {
          result.errors.push(`Failed to create semester ${sem.name}: ${error.message}`);
        } else if (newSem) {
          semesterMap[sem.num] = newSem.id;
          result.semesters_created++;
        }
      }
    }

    console.log("Semesters created/found:", semesterMap);

    // =============================================
    // STEP 3: Create Subjects for all semesters
    // =============================================
    const subjectMap: Record<string, { id: string; credits: number; semester: number }> = {};
    
    for (const [semNum, subjects] of Object.entries(SEMESTER_SUBJECTS)) {
      for (const subject of subjects) {
        // Check if subject exists
        const { data: existing } = await adminClient
          .from("subjects")
          .select("id, credits")
          .eq("code", subject.code)
          .single();
        
        if (existing) {
          subjectMap[subject.code] = { id: existing.id, credits: existing.credits, semester: parseInt(semNum) };
        } else {
          const { data: newSubject, error } = await adminClient
            .from("subjects")
            .insert({
              code: subject.code,
              name: subject.name,
              credits: subject.credits,
            })
            .select("id")
            .single();
          
          if (error) {
            // Might be duplicate - try to fetch again
            const { data: retryFetch } = await adminClient
              .from("subjects")
              .select("id, credits")
              .eq("code", subject.code)
              .single();
            
            if (retryFetch) {
              subjectMap[subject.code] = { id: retryFetch.id, credits: retryFetch.credits, semester: parseInt(semNum) };
            } else {
              result.errors.push(`Failed to create subject ${subject.code}: ${error.message}`);
            }
          } else if (newSubject) {
            subjectMap[subject.code] = { id: newSubject.id, credits: subject.credits, semester: parseInt(semNum) };
            result.subjects_created++;
          }
        }
      }
    }

    console.log(`Subjects created/found: ${Object.keys(subjectMap).length}`);

    // =============================================
    // STEP 4: Get existing students and teachers
    // =============================================
    const { data: studentRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");
    
    const studentIds = studentRoles?.map(r => r.user_id) || [];
    
    const { data: students } = await adminClient
      .from("profiles")
      .select("id, full_name, email, student_id")
      .in("id", studentIds);

    const { data: teacherRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    
    const teacherIds = teacherRoles?.map(r => r.user_id) || [];
    
    const { data: teachers } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", teacherIds);

    console.log(`Found ${students?.length || 0} students, ${teachers?.length || 0} teachers`);

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ error: "No students found. Please create students first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // =============================================
    // STEP 5: Define student performance trajectories
    // =============================================
    // Each student gets a trajectory that determines their GPA evolution
    type Trajectory = 'improving' | 'declining' | 'consistent_high' | 'consistent_medium' | 'struggling' | 'recovery';
    
    const trajectories: Trajectory[] = ['improving', 'declining', 'consistent_high', 'consistent_medium', 'struggling', 'recovery'];
    
    const studentTrajectories: Record<string, Trajectory> = {};
    students.forEach((student, index) => {
      studentTrajectories[student.id] = trajectories[index % trajectories.length];
    });

    // Function to generate marks based on trajectory and semester
    function generateMarks(trajectory: Trajectory, semesterNum: number, isLab: boolean): number {
      const random = () => Math.random();
      let baseMark: number;
      
      switch (trajectory) {
        case 'improving':
          // Start around 55-65, improve to 80-90 by semester 8
          baseMark = 55 + (semesterNum - 1) * 4 + random() * 10;
          break;
        case 'declining':
          // Start around 80-85, decline to 60-70 by semester 8
          baseMark = 85 - (semesterNum - 1) * 2.5 + random() * 10;
          break;
        case 'consistent_high':
          // Always 80-95
          baseMark = 80 + random() * 15;
          break;
        case 'consistent_medium':
          // Always 60-75
          baseMark = 60 + random() * 15;
          break;
        case 'struggling':
          // 35-55 range, some failures
          baseMark = 35 + random() * 20;
          break;
        case 'recovery':
          // Start low (40-50), recover to 70-80 by semester 8
          if (semesterNum <= 3) {
            baseMark = 40 + random() * 10;
          } else {
            baseMark = 50 + (semesterNum - 3) * 6 + random() * 10;
          }
          break;
        default:
          baseMark = 60 + random() * 20;
      }
      
      // Labs tend to score slightly higher
      if (isLab) {
        baseMark = Math.min(100, baseMark + 5);
      }
      
      // Add some randomness but keep within bounds
      const finalMark = Math.max(0, Math.min(100, Math.round(baseMark)));
      return finalMark;
    }

    // Function to find grade mapping for marks
    function findGradeMapping(marks: number) {
      return gradeMappings!.find(gm => marks >= gm.min_marks && marks <= gm.max_marks);
    }

    // =============================================
    // STEP 6: Create teacher assignments for all subjects
    // =============================================
    if (teachers && teachers.length > 0) {
      const subjectEntries = Object.entries(subjectMap);
      
      for (let i = 0; i < subjectEntries.length; i++) {
        const [code, subjectData] = subjectEntries[i];
        const teacher = teachers[i % teachers.length];
        const semesterId = semesterMap[subjectData.semester];
        
        if (!semesterId) continue;
        
        // Check if assignment exists
        const { data: existing } = await adminClient
          .from("teacher_assignments")
          .select("id")
          .eq("teacher_id", teacher.id)
          .eq("subject_id", subjectData.id)
          .eq("semester_id", semesterId)
          .single();
        
        if (!existing) {
          const { error } = await adminClient
            .from("teacher_assignments")
            .insert({
              teacher_id: teacher.id,
              subject_id: subjectData.id,
              semester_id: semesterId,
            });
          
          if (error && !error.message.includes("duplicate")) {
            result.errors.push(`Failed to assign teacher to ${code}: ${error.message}`);
          } else if (!error) {
            result.teacher_assignments_created++;
          }
        }
      }
    }

    console.log(`Teacher assignments created: ${result.teacher_assignments_created}`);

    // =============================================
    // STEP 7: Create enrollments and grades for all students across all semesters
    // =============================================
    for (const student of students) {
      const trajectory = studentTrajectories[student.id];
      
      // Enroll each student in semesters 1-8
      for (let semNum = 1; semNum <= 8; semNum++) {
        const semesterId = semesterMap[semNum];
        if (!semesterId) continue;
        
        // Get subjects for this semester
        const semesterSubjects = SEMESTER_SUBJECTS[semNum as keyof typeof SEMESTER_SUBJECTS] || [];
        
        for (const subject of semesterSubjects) {
          const subjectData = subjectMap[subject.code];
          if (!subjectData) continue;
          
          // Check if enrollment exists
          const { data: existingEnrollment } = await adminClient
            .from("enrollments")
            .select("id")
            .eq("student_id", student.id)
            .eq("subject_id", subjectData.id)
            .eq("semester_id", semesterId)
            .single();
          
          let enrollmentId: string;
          
          if (existingEnrollment) {
            enrollmentId = existingEnrollment.id;
          } else {
            const { data: newEnrollment, error } = await adminClient
              .from("enrollments")
              .insert({
                student_id: student.id,
                subject_id: subjectData.id,
                semester_id: semesterId,
              })
              .select("id")
              .single();
            
            if (error) {
              if (!error.message.includes("duplicate")) {
                result.errors.push(`Failed to enroll ${student.full_name} in ${subject.code}: ${error.message}`);
              }
              continue;
            }
            
            enrollmentId = newEnrollment.id;
            result.enrollments_created++;
          }
          
          // Check if grade exists
          const { data: existingGrade } = await adminClient
            .from("grades")
            .select("id")
            .eq("enrollment_id", enrollmentId)
            .single();
          
          if (!existingGrade) {
            // Generate marks based on trajectory
            const isLab = subject.credits <= 1.5;
            const marks = generateMarks(trajectory, semNum, isLab);
            const gradeMapping = findGradeMapping(marks);
            
            if (gradeMapping) {
              const { error } = await adminClient
                .from("grades")
                .insert({
                  enrollment_id: enrollmentId,
                  marks: marks,
                  grade_mapping_id: gradeMapping.id,
                });
              
              if (error && !error.message.includes("duplicate")) {
                result.errors.push(`Failed to create grade for ${student.full_name} in ${subject.code}: ${error.message}`);
              } else if (!error) {
                result.grades_created++;
              }
            }
          }
        }
      }
    }

    console.log(`Enrollments created: ${result.enrollments_created}, Grades created: ${result.grades_created}`);

    // =============================================
    // Final Summary
    // =============================================
    const summary = {
      success: true,
      message: "Multi-semester academic data seeding completed",
      result,
      summary: {
        total_students: students.length,
        total_teachers: teachers?.length || 0,
        total_semesters: Object.keys(semesterMap).length,
        total_subjects: Object.keys(subjectMap).length,
        student_trajectories: studentTrajectories,
      }
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
