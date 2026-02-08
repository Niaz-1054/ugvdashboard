import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 25 New realistic South Asian student profiles with diverse backgrounds
const NEW_STUDENTS = [
  // === SENIOR STUDENTS (Semester 7-8) - Batch 2021 ===
  { name: "Mahmudul Hasan Rafi", studentId: "12521060", email: "rafi@ugv.edu", batch: 2021 },
  { name: "Sadia Rahman Mim", studentId: "12521061", email: "mim@ugv.edu", batch: 2021 },
  { name: "Tanvir Ahmed Turzo", studentId: "12521062", email: "turzo@ugv.edu", batch: 2021 },
  { name: "Farzana Akter Moni", studentId: "12521063", email: "moni@ugv.edu", batch: 2021 },
  { name: "Rafiqul Islam Fahim", studentId: "12521065", email: "fahim@ugv.edu", batch: 2021 },
  
  // === MID-LEVEL STUDENTS (Semester 4-5) - Batch 2022 ===
  { name: "Shakib Al Hasan", studentId: "12522001", email: "shakib@ugv.edu", batch: 2022 },
  { name: "Tasnim Ferdous", studentId: "12522002", email: "tasnim@ugv.edu", batch: 2022 },
  { name: "Imran Khan Shanto", studentId: "12522003", email: "shanto@ugv.edu", batch: 2022 },
  { name: "Nusrat Jahan Mithila", studentId: "12522004", email: "mithila@ugv.edu", batch: 2022 },
  { name: "Sabbir Rahman", studentId: "12522005", email: "sabbir@ugv.edu", batch: 2022 },
  { name: "Fatima Begum", studentId: "12522006", email: "fatima@ugv.edu", batch: 2022 },
  { name: "Asif Mahmud", studentId: "12522007", email: "asif@ugv.edu", batch: 2022 },
  { name: "Rabeya Khatun", studentId: "12522008", email: "rabeya@ugv.edu", batch: 2022 },
  
  // === JUNIOR STUDENTS (Semester 2-3) - Batch 2023 ===
  { name: "Mehedi Hasan Miraz", studentId: "12523001", email: "miraz@ugv.edu", batch: 2023 },
  { name: "Sumaiya Islam Ritu", studentId: "12523002", email: "ritu@ugv.edu", batch: 2023 },
  { name: "Nafis Iqbal", studentId: "12523003", email: "nafis@ugv.edu", batch: 2023 },
  { name: "Ayesha Siddiqua", studentId: "12523004", email: "ayesha@ugv.edu", batch: 2023 },
  { name: "Saiful Islam", studentId: "12523005", email: "saiful@ugv.edu", batch: 2023 },
  { name: "Jannatul Ferdous", studentId: "12523006", email: "jannatul@ugv.edu", batch: 2023 },
  { name: "Rakibul Hasan", studentId: "12523007", email: "rakibul@ugv.edu", batch: 2023 },
  
  // === FRESHMEN (Semester 1-2) - Batch 2024 ===
  { name: "Tamim Iqbal Khan", studentId: "12524001", email: "tamim@ugv.edu", batch: 2024 },
  { name: "Sharmin Akter", studentId: "12524002", email: "sharmin@ugv.edu", batch: 2024 },
  { name: "Mushfiqur Rahim", studentId: "12524003", email: "mushfiq@ugv.edu", batch: 2024 },
  { name: "Lamia Akter", studentId: "12524004", email: "lamia@ugv.edu", batch: 2024 },
  { name: "Hasibul Hasan", studentId: "12524005", email: "hasibul@ugv.edu", batch: 2024 },
];

// Curriculum by semester - subjects per semester
const SEMESTER_SUBJECTS: Record<number, string[]> = {
  1: ["0611-1101", "0611-1102", "0613-1103", "0613-1104", "0541-1101", "0531-1101"],
  2: ["0613-1201", "0613-1203", "0613-1204", "0541-1201", "0533-1201", "0613-1205"],
  3: ["0613-2101", "0613-2102", "0613-2103", "0613-2104", "0541-2101", "0251-2101"],
  4: ["0613-2201", "0613-2202", "0613-2203", "0613-2204", "0541-2201", "0471-2201"],
  5: ["0613-3101", "0613-3102", "0613-3103", "0613-3104", "0613-3105", "0613-3106"],
  6: ["0613-3201", "0613-3202", "0613-3203", "0613-3204", "0613-3205", "0613-3206"],
  7: ["0613-4101", "0613-4102", "0613-4103", "0613-4104", "0613-4105", "0613-4106"],
  8: ["0613-4201", "0613-4203", "0613-4204", "0613-4205", "0613-4206", "0613-4207"],
};

// Map batch to number of semesters completed
const BATCH_SEMESTERS: Record<number, number[]> = {
  2021: [1, 2, 3, 4, 5, 6, 7, 8], // Senior - all 8 semesters
  2022: [1, 2, 3, 4, 5],          // Mid-level - 5 semesters
  2023: [1, 2, 3],                // Junior - 3 semesters
  2024: [1, 2],                   // Freshman - 2 semesters
};

// Map semester number to semester name (Summer/Winter)
const SEMESTER_NAME_MAP: Record<number, string> = {
  1: "Summer 2021",
  2: "Winter 2021",
  3: "Summer 2022",
  4: "Winter 2022",
  5: "Summer 2023",
  6: "Winter 2023",
  7: "Summer 2024",
  8: "Winter 2024",
};

// Performance profiles - determines grade generation pattern
type PerformanceProfile = 'high_performer' | 'consistent_good' | 'average' | 'improving' | 'struggling' | 'mixed';

// Assign performance profiles to students (distributed)
function getPerformanceProfile(index: number): PerformanceProfile {
  const profiles: PerformanceProfile[] = [
    'high_performer', 'high_performer', 'high_performer',
    'consistent_good', 'consistent_good', 'consistent_good', 'consistent_good',
    'average', 'average', 'average', 'average', 'average',
    'improving', 'improving', 'improving',
    'struggling', 'struggling',
    'mixed', 'mixed', 'mixed',
    'consistent_good', 'average', 'improving', 'high_performer', 'mixed'
  ];
  return profiles[index % profiles.length];
}

// Strong/weak subject indices per student (for personalization)
function getStudentStrengths(studentIndex: number): { strong: number[]; weak: number[] } {
  const patterns = [
    { strong: [0, 1], weak: [4, 5] },       // Strong in first subjects, weak in last
    { strong: [2, 3], weak: [0, 1] },       // Strong in middle, weak in first
    { strong: [4, 5], weak: [2, 3] },       // Strong in last, weak in middle
    { strong: [0, 3], weak: [1, 4] },       // Alternating
    { strong: [1, 4], weak: [0, 5] },
    { strong: [0, 2, 4], weak: [1] },       // Strong in theory, weak in first lab
    { strong: [1, 3, 5], weak: [0] },       // Strong in labs
    { strong: [0, 1, 2], weak: [5] },       // Strong start
    { strong: [3, 4, 5], weak: [0] },       // Strong finish
    { strong: [2], weak: [0, 5] },          // One standout subject
  ];
  return patterns[studentIndex % patterns.length];
}

// Generate marks based on profile, semester, and subject position
function generateMarks(
  profile: PerformanceProfile,
  semesterNum: number,
  subjectIndex: number,
  isStrong: boolean,
  isWeak: boolean,
  isLab: boolean
): number {
  const rand = () => Math.random();
  let base: number;

  switch (profile) {
    case 'high_performer':
      base = 85 + rand() * 12; // 85-97
      break;
    case 'consistent_good':
      base = 72 + rand() * 15; // 72-87
      break;
    case 'average':
      base = 58 + rand() * 18; // 58-76
      break;
    case 'improving':
      // Start around 50, improve to 80+ by semester 8
      base = 48 + (semesterNum - 1) * 4.5 + rand() * 12;
      break;
    case 'struggling':
      base = 42 + rand() * 20; // 42-62
      // Some semesters slightly better
      if (semesterNum % 2 === 0) base += 5;
      break;
    case 'mixed':
      // Unpredictable - some high, some low
      base = 55 + rand() * 35; // 55-90 (wide range)
      break;
    default:
      base = 65 + rand() * 15;
  }

  // Apply strong/weak modifiers
  if (isStrong) base += 8 + rand() * 5;
  if (isWeak) base -= 8 + rand() * 5;

  // Labs tend to score slightly higher
  if (isLab) base += 3 + rand() * 2;

  // Clamp between 35 and 98
  return Math.max(35, Math.min(98, Math.round(base)));
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

    // Get existing semesters
    const { data: semesters } = await adminClient
      .from("semesters")
      .select("id, name");
    
    const semesterIdMap: Record<string, string> = {};
    semesters?.forEach(s => { semesterIdMap[s.name] = s.id; });

    // Get existing subjects
    const { data: subjects } = await adminClient
      .from("subjects")
      .select("id, code, credits");
    
    const subjectMap: Record<string, { id: string; credits: number }> = {};
    subjects?.forEach(s => { subjectMap[s.code] = { id: s.id, credits: s.credits }; });

    // Find grade mapping for marks
    function findGradeMapping(marks: number) {
      return gradeMappings!.find(gm => marks >= gm.min_marks && marks <= gm.max_marks);
    }

    const result = {
      students_created: 0,
      enrollments_created: 0,
      grades_created: 0,
      errors: [] as string[],
    };

    // Process each new student
    for (let i = 0; i < NEW_STUDENTS.length; i++) {
      const student = NEW_STUDENTS[i];
      
      // Check if student already exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("student_id", student.studentId)
        .single();

      if (existingProfile) {
        console.log(`Student ${student.name} already exists, skipping...`);
        continue;
      }

      // Create auth user
      const password = "UGV@" + student.studentId;
      const { data: authUser, error: authCreateError } = await adminClient.auth.admin.createUser({
        email: student.email,
        password: password,
        email_confirm: true,
      });

      if (authCreateError || !authUser.user) {
        result.errors.push(`Failed to create auth for ${student.name}: ${authCreateError?.message}`);
        continue;
      }

      const userId = authUser.user.id;

      // Create profile
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({
          id: userId,
          full_name: student.name,
          email: student.email,
          student_id: student.studentId,
        });

      if (profileError) {
        result.errors.push(`Failed to create profile for ${student.name}: ${profileError.message}`);
        continue;
      }

      // Assign student role
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "student",
        });

      if (roleError) {
        result.errors.push(`Failed to assign role for ${student.name}: ${roleError.message}`);
        continue;
      }

      result.students_created++;
      console.log(`Created student: ${student.name} (${student.studentId})`);

      // Get performance profile and strengths
      const profile = getPerformanceProfile(i);
      const { strong, weak } = getStudentStrengths(i);

      // Create enrollments and grades for each semester the student has completed
      const semestersToEnroll = BATCH_SEMESTERS[student.batch] || [];

      for (const semNum of semestersToEnroll) {
        const semesterName = SEMESTER_NAME_MAP[semNum];
        const semesterId = semesterIdMap[semesterName];
        
        if (!semesterId) {
          result.errors.push(`Semester ${semesterName} not found`);
          continue;
        }

        const subjectCodes = SEMESTER_SUBJECTS[semNum] || [];

        for (let j = 0; j < subjectCodes.length; j++) {
          const code = subjectCodes[j];
          const subjectData = subjectMap[code];
          
          if (!subjectData) {
            result.errors.push(`Subject ${code} not found`);
            continue;
          }

          // Create enrollment
          const { data: enrollment, error: enrollError } = await adminClient
            .from("enrollments")
            .insert({
              student_id: userId,
              subject_id: subjectData.id,
              semester_id: semesterId,
            })
            .select("id")
            .single();

          if (enrollError) {
            // Might already exist
            continue;
          }

          result.enrollments_created++;

          // Generate grade
          const isStrong = strong.includes(j);
          const isWeak = weak.includes(j);
          const isLab = code.includes("02") || code.includes("04") || code.includes("06") || code.includes("08");
          
          const marks = generateMarks(profile, semNum, j, isStrong, isWeak, isLab);
          const gradeMapping = findGradeMapping(marks);

          if (!gradeMapping) {
            result.errors.push(`No grade mapping for marks ${marks}`);
            continue;
          }

          const { error: gradeError } = await adminClient
            .from("grades")
            .insert({
              enrollment_id: enrollment.id,
              marks: marks,
              grade_mapping_id: gradeMapping.id,
            });

          if (gradeError) {
            result.errors.push(`Failed to create grade for ${student.name}: ${gradeError.message}`);
          } else {
            result.grades_created++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Created ${result.students_created} students with ${result.enrollments_created} enrollments and ${result.grades_created} grades`,
      details: result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
