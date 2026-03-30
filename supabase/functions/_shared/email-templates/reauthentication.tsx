/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const BRAND = 'ST Engineering'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Mã xác thực {BRAND} của bạn: {token}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>🔐 Mã xác thực</Heading>
          <Text style={text}>
            Sử dụng mã bên dưới để xác nhận danh tính của bạn:
          </Text>

          <Section style={codeBox}>
            <Text style={codeStyle}>{token}</Text>
          </Section>

          <Text style={expireText}>
            ⏱ Mã này sẽ hết hạn sau 10 phút.
          </Text>
        </Section>

        <Section style={footerSection}>
          <Text style={warningText}>
            ⚠️ Không chia sẻ mã này với bất kỳ ai. Nhân viên {BRAND} sẽ không bao giờ hỏi mã của bạn.
          </Text>
          <Text style={footer}>
            Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
          </Text>
          <Text style={copyright}>
            © {new Date().getFullYear()} {BRAND}. Tất cả quyền được bảo lưu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}
const wrapper = { maxWidth: '560px', margin: '0 auto', padding: '20px 0' }
const header = {
  backgroundColor: '#0b0f1d',
  backgroundImage: 'linear-gradient(135deg, #0b0f1d 0%, #141b2d 50%, #0b0f1d 100%)',
  padding: '28px 32px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = {
  color: '#00b8d4',
  fontSize: '20px',
  fontWeight: 'bold' as const,
  letterSpacing: '2px',
  margin: '0',
  textTransform: 'uppercase' as const,
}
const card = {
  backgroundColor: '#ffffff',
  padding: '32px',
  borderLeft: '1px solid #e4e4e7',
  borderRight: '1px solid #e4e4e7',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0b0f1d',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeBox = {
  backgroundColor: '#0b0f1d',
  borderRadius: '8px',
  padding: '20px',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const codeStyle = {
  fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#00b8d4',
  letterSpacing: '8px',
  margin: '0',
}
const expireText = {
  fontSize: '13px',
  color: '#71717a',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
const footerSection = {
  backgroundColor: '#fafafa',
  padding: '20px 32px',
  borderRadius: '0 0 12px 12px',
  border: '1px solid #e4e4e7',
  borderTop: 'none',
  textAlign: 'center' as const,
}
const warningText = {
  fontSize: '12px',
  color: '#ef4444',
  margin: '0 0 8px',
  fontWeight: '500' as const,
}
const footer = { fontSize: '12px', color: '#a1a1aa', margin: '0 0 8px' }
const copyright = { fontSize: '11px', color: '#d4d4d8', margin: '0' }
