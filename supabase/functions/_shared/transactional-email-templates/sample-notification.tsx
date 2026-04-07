/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Hr,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND = 'ST Engineering'

interface SampleNotificationProps {
  title?: string
  message?: string
  name?: string
}

const SampleNotificationEmail = ({ title, message, name }: SampleNotificationProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>{title || 'Thông báo từ ' + BRAND}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>{title || 'Thông báo'}</Heading>
          <Text style={text}>
            {name ? `Xin chào ${name},` : 'Xin chào,'}
          </Text>
          <Text style={text}>
            {message || 'Đây là thông báo từ hệ thống ST Engineering.'}
          </Text>
          <Hr style={divider} />
          <Text style={footer}>
            Trân trọng, Đội ngũ {BRAND}
          </Text>
        </Section>

        <Section style={footerSection}>
          <Text style={copyright}>
            © {new Date().getFullYear()} {BRAND}. Tất cả quyền được bảo lưu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SampleNotificationEmail,
  subject: (data: Record<string, any>) => data.title || 'Thông báo từ ST Engineering',
  displayName: 'Thông báo mẫu',
  previewData: { title: 'Chào mừng!', message: 'Cảm ơn bạn đã sử dụng dịch vụ.', name: 'Nguyễn Văn A' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
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
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0b0f1d',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const divider = { borderTop: '1px solid #e4e4e7', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#71717a', margin: '0' }
const footerSection = {
  backgroundColor: '#fafafa',
  padding: '16px 32px',
  borderRadius: '0 0 12px 12px',
  border: '1px solid #e4e4e7',
  borderTop: 'none',
  textAlign: 'center' as const,
}
const copyright = { fontSize: '11px', color: '#d4d4d8', margin: '0' }