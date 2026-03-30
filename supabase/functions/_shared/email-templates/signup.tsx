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
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const BRAND = 'ST Engineering'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Chào mừng bạn đến với {BRAND} — xác nhận email để bắt đầu</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        {/* Branded Header */}
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        {/* Content Card */}
        <Section style={card}>
          <Heading style={h1}>Chào mừng bạn! 🎉</Heading>
          <Text style={text}>
            Cảm ơn bạn đã đăng ký tài khoản tại{' '}
            <Link href={siteUrl} style={link}>
              <strong>{BRAND}</strong>
            </Link>
            . Chỉ còn một bước nữa để hoàn tất đăng ký.
          </Text>
          <Text style={text}>
            Vui lòng xác nhận địa chỉ email{' '}
            <strong style={{ color: '#0b0f1d' }}>{recipient}</strong>{' '}
            bằng cách nhấn nút bên dưới:
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>
              ✓ Xác Nhận Email
            </Button>
          </Section>

          <Hr style={divider} />

          <Text style={helpText}>
            Nút không hoạt động? Sao chép và dán link sau vào trình duyệt:
          </Text>
          <Text style={urlText}>{confirmationUrl}</Text>
        </Section>

        {/* Footer */}
        <Section style={footerSection}>
          <Text style={footer}>
            Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.
          </Text>
          <Text style={copyright}>
            © {new Date().getFullYear()} {BRAND}. Tất cả quyền được bảo lưu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#00b8d4', textDecoration: 'none' }
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
const helpText = {
  fontSize: '12px',
  color: '#71717a',
  margin: '0 0 8px',
}
const urlText = {
  fontSize: '11px',
  color: '#00b8d4',
  wordBreak: 'break-all' as const,
  margin: '0',
}
const footerSection = {
  backgroundColor: '#fafafa',
  padding: '20px 32px',
  borderRadius: '0 0 12px 12px',
  border: '1px solid #e4e4e7',
  borderTop: 'none',
  textAlign: 'center' as const,
}
const footer = { fontSize: '12px', color: '#a1a1aa', margin: '0 0 8px' }
const copyright = { fontSize: '11px', color: '#d4d4d8', margin: '0' }
