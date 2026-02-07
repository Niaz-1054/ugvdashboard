import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Target, Lightbulb } from 'lucide-react';
import { SemesterGPA } from '@/lib/supabase-types';
import { getGPAStatus, isAtAcademicRisk } from '@/lib/gpa-calculator';

interface GPAInsightsProps {
  semesterData: SemesterGPA[];
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
}

export function GPAInsights({ semesterData, cgpa, totalCredits, earnedCredits }: GPAInsightsProps) {
  const atRisk = isAtAcademicRisk(cgpa);
  const gpaStatus = getGPAStatus(cgpa);

  // Calculate GPA trend
  const gpaTrend = semesterData.map((sem, index) => ({
    semester: sem.semesterName,
    gpa: sem.gpa,
    cgpa: calculateCGPAUpTo(semesterData, index)
  }));

  // Calculate improvement/decline
  const latestGPA = semesterData.length > 0 ? semesterData[semesterData.length - 1].gpa : 0;
  const previousGPA = semesterData.length > 1 ? semesterData[semesterData.length - 2].gpa : latestGPA;
  const gpaDiff = latestGPA - previousGPA;
  const isImproving = gpaDiff >= 0;

  // Get struggling subjects (grade point < 2.0)
  const strugglingSubjects = semesterData
    .flatMap(s => s.subjects)
    .filter(s => s.gradePoint < 2.0 && s.gradePoint > 0);

  // Get strong subjects (grade point >= 3.5)
  const strongSubjects = semesterData
    .flatMap(s => s.subjects)
    .filter(s => s.gradePoint >= 3.5);

  // Calculate required GPA to reach target
  const targetCGPA = 3.0;
  const requiredGPAForTarget = calculateRequiredGPA(cgpa, totalCredits, targetCGPA, 18); // Assuming 18 credits next sem

  // Insights generation
  const insights: { type: 'success' | 'warning' | 'info'; message: string }[] = [];
  
  if (atRisk) {
    insights.push({
      type: 'warning',
      message: 'Your CGPA is below 2.0. Consider meeting with an academic advisor to discuss improvement strategies.'
    });
  }
  
  if (gpaDiff > 0.2) {
    insights.push({
      type: 'success',
      message: `Great improvement! Your GPA increased by ${gpaDiff.toFixed(2)} points this semester.`
    });
  } else if (gpaDiff < -0.2) {
    insights.push({
      type: 'warning',
      message: `Your GPA decreased by ${Math.abs(gpaDiff).toFixed(2)} points. Review your study strategies.`
    });
  }

  if (strugglingSubjects.length > 0) {
    insights.push({
      type: 'info',
      message: `Focus on improving: ${strugglingSubjects.slice(0, 3).map(s => s.subjectCode).join(', ')}`
    });
  }

  if (strongSubjects.length >= 3) {
    insights.push({
      type: 'success',
      message: `Strong performance in ${strongSubjects.length} subjects with grade points above 3.5!`
    });
  }

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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{gpaStatus.label}</p>
            <p className="text-xs text-muted-foreground">Academic Standing</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{requiredGPAForTarget.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">GPA needed for 3.0 CGPA</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">{strongSubjects.length}</div>
            <p className="text-xs text-muted-foreground">Strong Subjects (≥3.5 GP)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-amber-600">{strugglingSubjects.length}</div>
            <p className="text-xs text-muted-foreground">Need Improvement (&lt;2.0 GP)</p>
          </CardContent>
        </Card>
      </div>

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

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Academic Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg text-sm ${
                  insight.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' :
                  insight.type === 'warning' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' :
                  'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                }`}
              >
                {insight.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
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
  
  return totalCredits > 0 ? totalWeightedPoints / totalCredits : 0;
}

function calculateRequiredGPA(
  currentCGPA: number, 
  currentCredits: number, 
  targetCGPA: number, 
  futureCredits: number
): number {
  // Formula: (currentCGPA * currentCredits + requiredGPA * futureCredits) / (currentCredits + futureCredits) = targetCGPA
  // Solving for requiredGPA:
  const requiredGPA = ((targetCGPA * (currentCredits + futureCredits)) - (currentCGPA * currentCredits)) / futureCredits;
  return Math.max(0, Math.min(4, requiredGPA)); // Clamp between 0 and 4
}
