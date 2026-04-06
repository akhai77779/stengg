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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const BRAND = 'ST Engineering'

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Xác nhận thay đổi email tài khoản {BRAND}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>📧 Xác nhận thay đổi email</Heading>
          <Text style={text}>
            Bạn đã yêu cầu thay đổi email cho tài khoản {BRAND}.
          </Text>

          <Section style={compareBox}>
            <Text style={compareLabel}>Email hiện tại:</Text>
            <Text style={compareValue}>
              <Link href={`mailto:${email}`} style={link}>{email}</Link>
            </Text>
            <Text style={compareArrow}>↓</Text>
            <Text style={compareLabel}>Email mới:</Text>
            <Text style={compareValue}>
              <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>
              Xác Nhận Thay Đổi
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
            ⚠️ Nếu bạn không yêu cầu thay đổi này, vui lòng bảo mật tài khoản ngay lập tức.
          </Text>
          <Text style={copyright}>
            © {new Date().getFullYear()} {BRAND}. Tất cả quyền được bảo lưu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const compareBox = {
  backgroundColor: '#f4f4f5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const compareLabel = { fontSize: '12px', color: '#71717a', margin: '0 0 4px' }
const compareValue = { fontSize: '15px', color: '#0b0f1d', fontWeight: 'bold' as const, margin: '0 0 8px' }
const compareArrow = { fontSize: '18px', color: '#00b8d4', margin: '4px 0' }
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
const copyright = { fontSize: '11px', color: '#d4d4d8', margin: '0' }
