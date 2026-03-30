/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Xác nhận email cho {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác nhận email của bạn</Heading>
        <Text style={text}>
          Cảm ơn bạn đã đăng ký tài khoản tại{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Vui lòng xác nhận địa chỉ email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) bằng cách nhấn nút bên dưới:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Xác Nhận Email
        </Button>
        <Text style={footer}>
          Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0b0f1d',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#00b8d4', textDecoration: 'underline' }
const button = {
  backgroundColor: '#00b8d4',
  color: '#0b0f1d',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
