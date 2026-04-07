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

interface TransactionApprovedProps {
  name?: string
  type?: string
  amount?: string
  txId?: string
}

const typeLabel = (type?: string) => {
  if (type === 'deposit') return 'Nạp tiền'
  if (type === 'withdraw') return 'Rút tiền'
  return type || 'Giao dịch'
}

const TransactionApprovedEmail = ({ name, type, amount, txId }: TransactionApprovedProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>{typeLabel(type)} thành công — {amount || ''}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Text style={logoText}>{BRAND}</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>✅ {typeLabel(type)} thành công</Heading>
          <Text style={text}>
            {name ? `Xin chào ${name},` : 'Xin chào,'}
          </Text>
          <Text style={text}>
            Yêu cầu <strong>{typeLabel(type).toLowerCase()}</strong> của bạn đã được duyệt thành công.
          </Text>

          <Section style={detailBox}>
            <Text style={detailRow}>
              <span style={detailLabel}>Loại giao dịch:</span> {typeLabel(type)}
            </Text>
            <Text style={detailRow}>
              <span style={detailLabel}>Số tiền:</span> {amount || 'N/A'}
            </Text>
            {txId && (
              <Text style={detailRow}>
                <span style={detailLabel}>Mã giao dịch:</span> {txId.slice(0, 8)}...
              </Text>
            )}
          </Section>

          <Hr style={divider} />
          <Text style={footer}>
            Nếu bạn không thực hiện yêu cầu này, vui lòng liên hệ bộ phận hỗ trợ ngay.
          </Text>
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
  component: TransactionApprovedEmail,
  subject: (data: Record<string, any>) =>
    `${data.type === 'deposit' ? 'Nạp tiền' : data.type === 'withdraw' ? 'Rút tiền' : 'Giao dịch'} thành công — ${data.amount || ''}`,
  displayName: 'Giao dịch được duyệt',
  previewData: { name: 'Nguyễn Văn A', type: 'deposit', amount: '$100.00', txId: 'abc12345-xxxx' },
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
  color: '#16a34a',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const detailBox = {
  backgroundColor: '#f4f4f5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}
const detailRow = {
  fontSize: '14px',
  color: '#3f3f46',
  lineHeight: '1.8',
  margin: '0',
}
const detailLabel = {
  color: '#71717a',
  fontWeight: 'normal' as const,
}
const divider = { borderTop: '1px solid #e4e4e7', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#71717a', margin: '0 0 8px' }
const footerSection = {
  backgroundColor: '#fafafa',
  padding: '16px 32px',
  borderRadius: '0 0 12px 12px',
  border: '1px solid #e4e4e7',
  borderTop: 'none',
  textAlign: 'center' as const,
}
const copyright = { fontSize: '11px', color: '#d4d4d8', margin: '0' }
