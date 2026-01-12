import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Layout } from "@/components/layout/Layout";
import { TradeDialog } from "@/components/product/TradeDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number | null;
  volume: string | null;
  price_change: number | null;
  image_url: string | null;
  description: string | null;
}

// Mock data for chart
const generateChartData = (basePrice: number) => {
  const data = [];
  let price = basePrice;
  for (let i = 0; i < 24; i++) {
    price = price * (1 + (Math.random() - 0.5) * 0.02);
    data.push({
      time: `${i}:00`,
      price: Number(price.toFixed(2)),
    });
  }
  return data;
};

// Mock transaction history
const mockTransactions = [
  { id: 1, type: "buy", price: 67543.25, amount: 0.05, time: "14:32:15", total: 3377.16 },
  { id: 2, type: "sell", price: 67520.00, amount: 0.12, time: "14:30:22", total: 8102.40 },
  { id: 3, type: "buy", price: 67555.80, amount: 0.08, time: "14:28:45", total: 5404.46 },
  { id: 4, type: "sell", price: 67510.50, amount: 0.15, time: "14:25:10", total: 10126.58 },
  { id: 5, type: "buy", price: 67530.25, amount: 0.03, time: "14:22:33", total: 2025.91 },
];

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [timeframe, setTimeframe] = useState("24H");
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setProduct(data);
      setChartData(generateChartData(data.price || 100));
    }
    setLoading(false);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "0";
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(4);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Không tìm thấy sản phẩm</p>
          <Button onClick={() => navigate("/products")}>Quay lại</Button>
        </div>
      </Layout>
    );
  }

  const isPositive = (product.price_change || 0) >= 0;

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {product.image_url && (
              <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded-full" />
            )}
            <h1 className="text-xl font-bold">{product.name}</h1>
          </div>
        </div>

        {/* Price Info */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary">
                ${formatPrice(product.price)}
              </span>
              <span className={`flex items-center text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {isPositive ? "+" : ""}{product.price_change?.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Vol 24H: {product.volume || "0"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex gap-2 mb-4">
              {["1H", "24H", "7D", "30D"].map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className="flex-1"
                >
                  {tf}
                </Button>
              ))}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    hide 
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="history" className="flex-1">Lịch sử GD</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">Thông tin</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="mt-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-0">
                <div className="grid grid-cols-5 gap-2 p-3 text-xs text-muted-foreground border-b border-border/50">
                  <span>Loại</span>
                  <span>Giá</span>
                  <span>SL</span>
                  <span>Tổng</span>
                  <span>Thời gian</span>
                </div>
                {mockTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-5 gap-2 p-3 text-xs border-b border-border/30 last:border-0"
                  >
                    <span className={tx.type === "buy" ? "text-green-500" : "text-red-500"}>
                      {tx.type === "buy" ? "Mua" : "Bán"}
                    </span>
                    <span className="text-foreground">${tx.price.toLocaleString()}</span>
                    <span className="text-muted-foreground">{tx.amount}</span>
                    <span className="text-foreground">${tx.total.toLocaleString()}</span>
                    <span className="text-muted-foreground">{tx.time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="mt-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá hiện tại</span>
                  <span className="font-medium">${formatPrice(product.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Khối lượng 24H</span>
                  <span className="font-medium">{product.volume || "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thay đổi 24H</span>
                  <span className={`font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{product.price_change?.toFixed(2)}%
                  </span>
                </div>
                {product.description && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trade Buttons */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50">
          <div className="flex gap-3 max-w-md mx-auto">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/auth');
                  return;
                }
                setTradeType('buy');
                setTradeDialogOpen(true);
              }}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Mua
            </Button>
            <Button 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/auth');
                  return;
                }
                setTradeType('sell');
                setTradeDialogOpen(true);
              }}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Bán
            </Button>
          </div>
        </div>

        {/* Trade Dialog */}
        {product && (
          <TradeDialog
            isOpen={tradeDialogOpen}
            onClose={() => setTradeDialogOpen(false)}
            tradeType={tradeType}
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
            }}
            onSuccess={fetchProduct}
          />
        )}
      </div>
    </Layout>
  );
};

export default ProductDetail;
