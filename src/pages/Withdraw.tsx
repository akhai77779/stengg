import { useState } from "react";
import { ArrowLeft, Menu, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WithdrawPage() {
  const navigate = useNavigate();
  const [balance] = useState(0.0);
  const [amount, setAmount] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const minWithdraw = 10;
  const maxWithdraw = 0.0;
  const fee = 0.0;
  const feeRate = 0.3;

  const calculateTotal = () => {
    const amountNum = parseFloat(amount) || 0;
    return amountNum - fee;
  };

  const handleWithdraw = () => {
    // Implement withdraw logic here
    console.log("Withdraw:", {
      amount,
      country,
      currency,
      address,
      password,
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Rút tiền</h1>
        <Button variant="ghost" size="icon" className="text-white hover:bg-gray-800">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-400">Số cân bằng:</span>
              <span className="text-lg font-semibold text-red-500">{balance.toFixed(2)} USD</span>
            </div>
            <div className="text-sm text-gray-500">≈ 0 VND</div>
          </div>
        </div>

        {/* Country Select */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Quốc gia</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full bg-transparent border-0 text-gray-400 h-auto p-0 focus:ring-0">
              <SelectValue placeholder="Vui lòng chọn một quốc gia" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-gray-800">
              <SelectItem value="vn">Vietnam</SelectItem>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="jp">Japan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency Select */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Tiền tệ</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full bg-transparent border-0 text-gray-400 h-auto p-0 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-gray-800">
              <SelectItem value="VND">VND - Vietnamese Dong</SelectItem>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Address Input */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Địa chỉ ví</Label>
          <Input
            type="text"
            placeholder="Nhập địa chỉ ví của bạn"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-transparent border-0 text-gray-400 placeholder:text-gray-600 h-auto p-0 focus-visible:ring-0"
          />
        </div>

        {/* Amount Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Số lượng</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Input
                type="number"
                placeholder="Vui lòng nhập số lượng"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent border-0 text-gray-400 placeholder:text-gray-600 h-auto p-0 flex-1 focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <span className="text-white">USD</span>
                <button className="text-red-500 text-sm font-medium">tất cả</button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Số tiền rút tiền tối thiểu</span>
              <span className="text-white">{minWithdraw} USD</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Số tiền rút tiền tối đa</span>
              <span className="text-white">{maxWithdraw.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Fee Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Phí xử lý</Label>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-white">{fee.toFixed(2)} USD</span>
              <span className="text-sm text-gray-500">≈ 0 VND</span>
            </div>
            <div className="text-sm text-gray-500">Tỷ lệ phí: {feeRate}%</div>
          </div>
        </div>

        {/* Password Input */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <Label className="text-sm text-white mb-2 block">Mật khẩu rút tiền</Label>
          <div className="flex items-center gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Vui lòng nhập mật khẩu rút tiền của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-0 text-gray-400 placeholder:text-gray-600 h-auto p-0 flex-1 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="text-red-500 hover:bg-transparent h-auto w-auto p-0"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleWithdraw}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6 rounded-lg"
        >
          Rút tiền
        </Button>
      </div>
    </div>
  );
}
