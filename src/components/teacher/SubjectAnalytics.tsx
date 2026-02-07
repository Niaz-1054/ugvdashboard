import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GradeMapping } from '@/lib/supabase-types';

interface SubjectAnalyticsProps {
  enrollments: any[];
  grades: Record<string, number>;
  gradeMappings: GradeMapping[];
  subjectName: string;
}

export function SubjectAnalytics({ 
  enrollments, 
  grades, 
  gradeMappings, 
  subjectName 
}: SubjectAnalyticsProps) {
  const analytics = useMemo(() => {
    const studentsWithGrades = enrollments.filter(e => grades[e.id] !== undefined);
    const allMarks = studentsWithGrades.map(e => grades[e.id]);
    
    if (allMarks.length === 0) {
      return null;
    }

    // Calculate pass/fail (assuming 40 is pass mark)
    const passMark = 40;
    const passed = allMarks.filter(m => m >= passMark).length;
    const failed = allMarks.filter(m => m < passMark).length;
    const passRate = (passed / allMarks.length) * 100;

    // Calculate average
    const average = allMarks.reduce((a, b) => a + b, 0) / allMarks.length;

    // Calculate average grade point
    const gradePoints = studentsWithGrades.map(e => {
      const marks = grades[e.id];
      const mapping = getGradeFromMarks(marks, gradeMappings);
      return mapping?.grade_point || 0;
    });
    const avgGradePoint = gradePoints.reduce((a, b) => a + b, 0) / gradePoints.length;

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    studentsWithGrades.forEach(e => {
      const marks = grades[e.id];
      const mapping = getGradeFromMarks(marks, gradeMappings);
      const letter = mapping?.letter_grade || 'F';
      gradeDistribution[letter] = (gradeDistribution[letter] || 0) + 1;
    });

    // Convert to chart data
    const distributionData = Object.entries(gradeDistribution)
      .map(([grade, count]) => ({ grade, count, percentage: ((count / allMarks.length) * 100).toFixed(1) }))
      .sort((a, b) => {
        const order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
        return order.indexOf(a.grade) - order.indexOf(b.grade);
      });

    // Marks range distribution (for histogram)
    const rangeDistribution = [
      { range: '0-39', count: allMarks.filter(m => m < 40).length },
      { range: '40-49', count: allMarks.filter(m => m >= 40 && m < 50).length },
      { range: '50-59', count: allMarks.filter(m => m >= 50 && m < 60).length },
      { range: '60-69', count: allMarks.filter(m => m >= 60 && m < 70).length },
      { range: '70-79', count: allMarks.filter(m => m >= 70 && m < 80).length },
      { range: '80-89', count: allMarks.filter(m => m >= 80 && m < 90).length },
      { range: '90-100', count: allMarks.filter(m => m >= 90).length },
    ];

    return {
      totalStudents: enrollments.length,
      gradedStudents: allMarks.length,
      passed,
      failed,
      passRate,
      average,
      avgGradePoint,
      highest: Math.max(...allMarks),
      lowest: Math.min(...allMarks),
      distributionData,
      rangeDistribution
    };
  }, [enrollments, grades, gradeMappings]);

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No grades entered yet</p>
          <p className="text-sm">Analytics will appear once you enter marks</p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280'];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.gradedStudents}/{analytics.totalStudents}</p>
                <p className="text-xs text-muted-foreground">Graded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.passed}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgGradePoint.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Avg GP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pass Rate Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pass Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={analytics.passRate} className="flex-1" />
            <Badge variant={analytics.passRate >= 70 ? 'default' : analytics.passRate >= 50 ? 'secondary' : 'destructive'}>
              {analytics.passRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>Average: {analytics.average.toFixed(1)}</span>
            <span>Highest: {analytics.highest} | Lowest: {analytics.lowest}</span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grade Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>Number of students per grade</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip 
                  formatter={(value: number, name: string) => [value, 'Students']}
                  labelFormatter={(label) => `Grade: ${label}`}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Marks Range Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marks Distribution</CardTitle>
            <CardDescription>Students by marks range</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.rangeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={10} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper function
function getGradeFromMarks(marks: number, gradeMappings: GradeMapping[]): GradeMapping | null {
  const sortedMappings = [...gradeMappings].sort((a, b) => b.min_marks - a.min_marks);
  
  for (const mapping of sortedMappings) {
    if (marks >= mapping.min_marks && marks <= mapping.max_marks) {
      return mapping;
    }
  }
  
  return null;
}
