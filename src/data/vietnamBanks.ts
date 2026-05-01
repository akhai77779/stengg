export interface VietnamBank {
  code: string;
  name: string;
  shortName: string;
  bin?: string;
}

// Danh sách ngân hàng Việt Nam phổ biến
export const VIETNAM_BANKS: VietnamBank[] = [
  { code: "VCB", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", bin: "970436" },
  { code: "TCB", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)", bin: "970407" },
  { code: "MB", shortName: "MB Bank", name: "Ngân hàng TMCP Quân đội (MB Bank)", bin: "970422" },
  { code: "VTB", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)", bin: "970415" },
  { code: "BIDV", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", bin: "970418" },
  { code: "AGB", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)", bin: "970405" },
  { code: "ACB", shortName: "ACB", name: "Ngân hàng TMCP Á Châu (ACB)", bin: "970416" },
  { code: "VPB", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)", bin: "970432" },
  { code: "TPB", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong (TPBank)", bin: "970423" },
  { code: "STB", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)", bin: "970403" },
  { code: "HDB", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP.HCM (HDBank)", bin: "970437" },
  { code: "VIB", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam (VIB)", bin: "970441" },
  { code: "SHB", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)", bin: "970443" },
  { code: "EIB", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)", bin: "970431" },
  { code: "MSB", shortName: "MSB", name: "Ngân hàng TMCP Hàng hải Việt Nam (MSB)", bin: "970426" },
  { code: "OCB", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông (OCB)", bin: "970448" },
  { code: "SCB", shortName: "SCB", name: "Ngân hàng TMCP Sài Gòn (SCB)", bin: "970429" },
  { code: "SeAB", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á (SeABank)", bin: "970440" },
  { code: "LPB", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)", bin: "970449" },
  { code: "NAB", shortName: "Nam A Bank", name: "Ngân hàng TMCP Nam Á (Nam A Bank)", bin: "970428" },
  { code: "BVB", shortName: "BaoVietBank", name: "Ngân hàng TMCP Bảo Việt (BaoVietBank)", bin: "970438" },
  { code: "PVB", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)", bin: "970412" },
  { code: "ABB", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình (ABBANK)", bin: "970425" },
  { code: "VAB", shortName: "VietABank", name: "Ngân hàng TMCP Việt Á (VietABank)", bin: "970427" },
  { code: "VCCB", shortName: "BVBank", name: "Ngân hàng TMCP Bản Việt (BVBank)", bin: "970454" },
  { code: "KLB", shortName: "Kienlongbank", name: "Ngân hàng TMCP Kiên Long (Kienlongbank)", bin: "970452" },
  { code: "NCB", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân (NCB)", bin: "970419" },
  { code: "PGB", shortName: "PGBank", name: "Ngân hàng TMCP Xăng dầu Petrolimex (PGBank)", bin: "970430" },
  { code: "VBB", shortName: "VietBank", name: "Ngân hàng TMCP Việt Nam Thương Tín (VietBank)", bin: "970433" },
  { code: "SGB", shortName: "Saigonbank", name: "Ngân hàng TMCP Sài Gòn Công Thương (Saigonbank)", bin: "970400" },
  { code: "DAB", shortName: "DongA Bank", name: "Ngân hàng TMCP Đông Á (DongA Bank)", bin: "970406" },
  { code: "OCEAN", shortName: "OceanBank", name: "Ngân hàng TM TNHH MTV Đại Dương (OceanBank)", bin: "970414" },
  { code: "GPB", shortName: "GPBank", name: "Ngân hàng TM TNHH MTV Dầu Khí Toàn Cầu (GPBank)", bin: "970408" },
  { code: "CBB", shortName: "CBBank", name: "Ngân hàng Xây dựng (CBBank)", bin: "970444" },
  { code: "CAKE", shortName: "CAKE", name: "Ngân hàng số CAKE by VPBank", bin: "546034" },
  { code: "UBB", shortName: "Ubank", name: "Ngân hàng số Ubank by VPBank", bin: "546035" },
  { code: "TIMO", shortName: "Timo", name: "Ngân hàng số Timo by Bản Việt Bank", bin: "963388" },
];
