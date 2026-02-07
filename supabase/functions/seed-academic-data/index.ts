import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeedResult {
  enrollments_created: number;
  teacher_assignments_created: number;
  grades_created: number;
  feedback_created: number;
  skipped: string[];
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
      enrollments_created: 0,
      teacher_assignments_created: 0,
      grades_created: 0,
      feedback_created: 0,
      skipped: [],
      errors: []
    };

    // Get existing data
    const { data: semester } = await adminClient
      .from("semesters")
      .select("id")
      .single();

    if (!semester) {
      return new Response(JSON.stringify({ error: "No semester found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const semesterId = semester.id;

    // Get all subjects
    const { data: subjects } = await adminClient
      .from("subjects")
      .select("id, code, name, credits");

    if (!subjects || subjects.length === 0) {
      return new Response(JSON.stringify({ error: "No subjects found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get all students
    const { data: students } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", (
        await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "student")
      ).data?.map(r => r.user_id) || []);

    // Get all teachers
    const { data: teachers } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", (
        await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "teacher")
      ).data?.map(r => r.user_id) || []);

    // Get grade mappings
    const { data: gradeMappings } = await adminClient
      .from("grade_mappings")
      .select("*")
      .order("min_marks", { ascending: false });

    if (!gradeMappings || gradeMappings.length === 0) {
      return new Response(JSON.stringify({ error: "No grade mappings found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get existing enrollments
    const { data: existingEnrollments } = await adminClient
      .from("enrollments")
      .select("student_id, subject_id, semester_id");

    const enrollmentSet = new Set(
      (existingEnrollments || []).map(e => `${e.student_id}-${e.subject_id}-${e.semester_id}`)
    );

    // Get existing teacher assignments
    const { data: existingAssignments } = await adminClient
      .from("teacher_assignments")
      .select("teacher_id, subject_id, semester_id");

    const assignmentSet = new Set(
      (existingAssignments || []).map(a => `${a.teacher_id}-${a.subject_id}-${a.semester_id}`)
    );

    // Get existing grades
    const { data: existingGrades } = await adminClient
      .from("grades")
      .select("enrollment_id");

    const gradeEnrollmentSet = new Set(
      (existingGrades || []).map(g => g.enrollment_id)
    );

    console.log(`Found ${students?.length || 0} students, ${teachers?.length || 0} teachers, ${subjects.length} subjects`);

    // STEP 1: Assign teachers to subjects (one teacher per subject)
    if (teachers && teachers.length > 0) {
      for (let i = 0; i < subjects.length; i++) {
        const subject = subjects[i];
        const teacher = teachers[i % teachers.length]; // Distribute evenly
        const key = `${teacher.id}-${subject.id}-${semesterId}`;
        
        if (!assignmentSet.has(key)) {
          const { error } = await adminClient
            .from("teacher_assignments")
            .insert({
              teacher_id: teacher.id,
              subject_id: subject.id,
              semester_id: semesterId
            });
          
          if (error) {
            result.errors.push(`Failed to assign ${teacher.full_name} to ${subject.code}: ${error.message}`);
          } else {
            result.teacher_assignments_created++;
            assignmentSet.add(key);
          }
        } else {
          result.skipped.push(`Teacher assignment for ${subject.code} already exists`);
        }
      }
    }

    // STEP 2: Enroll all students in all subjects
    const newEnrollments: { id: string; student_id: string; subject_id: string }[] = [];
    
    if (students && students.length > 0) {
      for (const student of students) {
        for (const subject of subjects) {
          const key = `${student.id}-${subject.id}-${semesterId}`;
          
          if (!enrollmentSet.has(key)) {
            const { data: enrollment, error } = await adminClient
              .from("enrollments")
              .insert({
                student_id: student.id,
                subject_id: subject.id,
                semester_id: semesterId
              })
              .select("id, student_id, subject_id")
              .single();
            
            if (error) {
              result.errors.push(`Failed to enroll ${student.full_name} in ${subject.code}: ${error.message}`);
            } else if (enrollment) {
              result.enrollments_created++;
              newEnrollments.push(enrollment);
              enrollmentSet.add(key);
            }
          } else {
            result.skipped.push(`${student.full_name} already enrolled in ${subject.code}`);
          }
        }
      }
    }

    // STEP 3: Get ALL enrollments for grade generation
    const { data: allEnrollments } = await adminClient
      .from("enrollments")
      .select("id, student_id, subject_id, semester_id")
      .eq("semester_id", semesterId);

    // Define student performance profiles for realistic variation
    const studentPerformanceProfiles: Record<string, 'high' | 'medium' | 'low' | 'uneven'> = {};
    
    if (students) {
      const studentCount = students.length;
      students.forEach((student, index) => {
        if (index === 0) {
          // First student: high performer
          studentPerformanceProfiles[student.id] = 'high';
        } else if (index === 1 || index === 2) {
          // 2nd and 3rd: low performers (for risk demo)
          studentPerformanceProfiles[student.id] = 'low';
        } else if (index === 3) {
          // 4th: uneven performer
          studentPerformanceProfiles[student.id] = 'uneven';
        } else {
          // Rest: medium performers
          studentPerformanceProfiles[student.id] = 'medium';
        }
      });
    }

    // Function to generate marks based on performance profile
    function generateMarks(profile: 'high' | 'medium' | 'low' | 'uneven', subjectIndex: number): number {
      const random = () => Math.random();
      
      switch (profile) {
        case 'high':
          // 80-95 range
          return Math.floor(80 + random() * 15);
        case 'low':
          // 35-55 range (some failing, some barely passing)
          return Math.floor(35 + random() * 20);
        case 'uneven':
          // Alternating: some very good (75-90), some poor (40-55)
          if (subjectIndex % 2 === 0) {
            return Math.floor(75 + random() * 15);
          } else {
            return Math.floor(40 + random() * 15);
          }
        case 'medium':
        default:
          // 55-80 range
          return Math.floor(55 + random() * 25);
      }
    }

    // Function to find grade mapping for marks
    function findGradeMapping(marks: number) {
      return gradeMappings!.find(gm => marks >= gm.min_marks && marks <= gm.max_marks);
    }

    // STEP 4: Generate grades for all enrollments
    if (allEnrollments) {
      for (const enrollment of allEnrollments) {
        if (gradeEnrollmentSet.has(enrollment.id)) {
          result.skipped.push(`Grade for enrollment ${enrollment.id} already exists`);
          continue;
        }

        const profile = studentPerformanceProfiles[enrollment.student_id] || 'medium';
        const subjectIndex = subjects.findIndex(s => s.id === enrollment.subject_id);
        const marks = generateMarks(profile, subjectIndex);
        const gradeMapping = findGradeMapping(marks);

        if (!gradeMapping) {
          result.errors.push(`No grade mapping found for marks ${marks}`);
          continue;
        }

        const { error } = await adminClient
          .from("grades")
          .insert({
            enrollment_id: enrollment.id,
            marks: marks,
            grade_mapping_id: gradeMapping.id
          });

        if (error) {
          result.errors.push(`Failed to create grade for enrollment ${enrollment.id}: ${error.message}`);
        } else {
          result.grades_created++;
          gradeEnrollmentSet.add(enrollment.id);
        }
      }
    }

    // STEP 5: Create feedback entries (only if none exist)
    const { data: existingFeedback, error: feedbackCheckError } = await adminClient
      .from("feedback")
      .select("id")
      .limit(1);

    if (!feedbackCheckError && (!existingFeedback || existingFeedback.length === 0) && students && students.length > 0) {
      const feedbackEntries = [
        {
          student_id: students[0].id,
          subject: "Grade Inquiry",
          message: "I believe my marks for Chemistry (0531-1101) were incorrectly entered. I scored higher in the lab component but it's showing lower than expected.",
          status: "pending"
        },
        {
          student_id: students[1]?.id || students[0].id,
          subject: "Lab Grading Concern",
          message: "Please review my Physics Sessional (0533-1102) grading. I attended all sessions and submitted all reports on time.",
          status: "pending"
        },
        {
          student_id: students[2]?.id || students[0].id,
          subject: "Result Verification",
          message: "Thank you for resolving my previous query about the Calculus exam. The corrected grade has been updated.",
          status: "resolved",
          resolved_at: new Date().toISOString()
        },
        {
          student_id: students[3]?.id || students[0].id,
          subject: "Academic Support",
          message: "I am struggling with Structured Programming. Can you recommend any additional resources or tutoring options?",
          status: "pending"
        }
      ];

      for (const feedback of feedbackEntries) {
        const { error } = await adminClient
          .from("feedback")
          .insert(feedback);

        if (error) {
          result.errors.push(`Failed to create feedback: ${error.message}`);
        } else {
          result.feedback_created++;
        }
      }
    } else if (existingFeedback && existingFeedback.length > 0) {
      result.skipped.push("Feedback entries already exist");
    }

    // Summary
    const summary = {
      success: true,
      message: "Academic data seeding completed",
      result,
      summary: {
        total_students: students?.length || 0,
        total_teachers: teachers?.length || 0,
        total_subjects: subjects.length,
        semester_id: semesterId
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
