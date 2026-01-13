import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, DollarSign, ArrowUpDown } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface TransactionStats {
  date: string;
  deposits: number;
  withdrawals: number;
  trades: number;
  total: number;
}

interface SummaryStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalTrades: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const chartConfig = {
  deposits: {
    label: "Nạp tiền",
    color: "hsl(var(--chart-1))",
  },
  withdrawals: {
    label: "Rút tiền",
    color: "hsl(var(--chart-2))",
  },
  trades: {
    label: "Giao dịch",
    color: "hsl(var(--chart-3))",
  },
  total: {
    label: "Tổng",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const statusColors = {
  pending: "hsl(var(--chart-1))",
  approved: "hsl(var(--chart-2))",
  rejected: "hsl(var(--chart-3))",
};

export function DashboardStats() {
  const [dailyStats, setDailyStats] = useState<TransactionStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<TransactionStats[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalTrades: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get all transactions
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate summary stats
      const summaryData: SummaryStats = {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTrades: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      };

      transactions?.forEach((t) => {
        if (t.type === "deposit") summaryData.totalDeposits += Number(t.amount);
        if (t.type === "withdraw") summaryData.totalWithdrawals += Number(t.amount);
        if (t.type === "buy" || t.type === "sell") summaryData.totalTrades += Number(t.amount);
        if (t.status === "pending") summaryData.pendingCount++;
        if (t.status === "approved") summaryData.approvedCount++;
        if (t.status === "rejected") summaryData.rejectedCount++;
      });

      setSummary(summaryData);

      // Calculate daily stats (last 7 days)
      const now = new Date();
      const daily: TransactionStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayTransactions = transactions?.filter(
          (t) => t.created_at.split("T")[0] === dateStr
        );

        daily.push({
          date: date.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric" }),
          deposits: dayTransactions?.filter((t) => t.type === "deposit").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          withdrawals: dayTransactions?.filter((t) => t.type === "withdraw").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          trades: dayTransactions?.filter((t) => t.type === "buy" || t.type === "sell").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          total: dayTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
        });
      }
      setDailyStats(daily);

      // Calculate weekly stats (last 4 weeks)
      const weekly: TransactionStats[] = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);

        const weekTransactions = transactions?.filter((t) => {
          const tDate = new Date(t.created_at);
          return tDate >= weekStart && tDate < weekEnd;
        });

        weekly.push({
          date: `Tuần ${4 - i}`,
          deposits: weekTransactions?.filter((t) => t.type === "deposit").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          withdrawals: weekTransactions?.filter((t) => t.type === "withdraw").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          trades: weekTransactions?.filter((t) => t.type === "buy" || t.type === "sell").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
          total: weekTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
        });
      }
      setWeeklyStats(weekly);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const statusData = [
    { name: "Chờ duyệt", value: summary.pendingCount, color: statusColors.pending },
    { name: "Đã duyệt", value: summary.approvedCount, color: statusColors.approved },
    { name: "Từ chối", value: summary.rejectedCount, color: statusColors.rejected },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nạp tiền</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalDeposits)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng rút tiền</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalWithdrawals)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng giao dịch</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalTrades)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Flow</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalDeposits - summary.totalWithdrawals >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalDeposits - summary.totalWithdrawals)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Khối lượng giao dịch</CardTitle>
            <CardDescription>Theo ngày và tuần</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="space-y-4">
              <TabsList>
                <TabsTrigger value="daily">7 ngày</TabsTrigger>
                <TabsTrigger value="weekly">4 tuần</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={dailyStats}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="deposits" fill="var(--color-deposits)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="withdrawals" fill="var(--color-withdrawals)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="trades" fill="var(--color-trades)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="weekly" className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={weeklyStats}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="deposits" fill="var(--color-deposits)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="withdrawals" fill="var(--color-withdrawals)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="trades" fill="var(--color-trades)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Xu hướng tổng giá trị</CardTitle>
            <CardDescription>Tổng giá trị giao dịch theo thời gian</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="space-y-4">
              <TabsList>
                <TabsTrigger value="daily">7 ngày</TabsTrigger>
                <TabsTrigger value="weekly">4 tuần</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart data={dailyStats}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ fill: "var(--color-total)" }} />
                  </LineChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="weekly" className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart data={weeklyStats}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ fill: "var(--color-total)" }} />
                  </LineChart>
                </ChartContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Trạng thái giao dịch</CardTitle>
            <CardDescription>Phân bố theo trạng thái</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-[250px] w-full max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
