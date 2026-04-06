/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Hr,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const BRAND = 'ST Engineering'

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Đặt lại mật khẩu tài khoản {BRAND}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>🔑 Đặt lại mật khẩu</Heading>
          <Text style={text}>
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {BRAND} của bạn.
            Nhấn nút bên dưới để tạo mật khẩu mới.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>
              Đặt Lại Mật Khẩu
            </Button>
          </Section>

          <Hr style={divider} />

          <Text style={helpText}>
            Nút không hoạt động? Sao chép và dán link sau vào trình duyệt:
          </Text>
          <Text style={urlText}>{confirmationUrl}</Text>
        </Section>

        <Section style={footerSection}>
          <Text style={warningText}>
            ⚠️ Link này sẽ hết hạn sau 10 phút.
          </Text>
          <Text style={footer}>
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
            Mật khẩu của bạn sẽ không thay đổi.
          </Text>
          <Text style={copyright}>
            © {new Date().getFullYear()} {BRAND}. Tất cả quyền được bảo lưu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#00b8d4',
  color: '#0b0f1d',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const divider = { borderTop: '1px solid #e4e4e7', margin: '24px 0' }
const helpText = { fontSize: '12px', color: '#71717a', margin: '0 0 8px' }
const urlText = { fontSize: '11px', color: '#00b8d4', wordBreak: 'break-all' as const, margin: '0' }
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
