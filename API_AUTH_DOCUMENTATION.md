# Authentication API Documentation

## POST /api/auth/register

### Request

```json
{
  "name": "Nguyen Van A",
  "username": "nguyenvana",
  "email": "abc@gmail.com",
  "password": "123456",
  "passwordConfirm": "123456"
}
```

### Success Response

Status: 201

```json
{
  "success": true,
  "message": "Đăng ký thành công. Vui lòng xác thực email.",
  "token": "jwt_token",
  "user": {
    "id": "...",
    "name": "Nguyen Van A",
    "email": "abc@gmail.com",
    "role": "user",
    "isEmailVerified": false
  }
}
```

Cookie:

- accessToken (HttpOnly)

### Error

400

```json
{
  "success": false,
  "message": "Validation error."
}
```

409

```json
{
  "success": false,
  "message": "Email already exists."
}
```

---

## POST /api/auth/login

### Request

```json
{
  "email": "abc@gmail.com",
  "password": "123456"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "token": "jwt_token",
  "user": {
    "id": "...",
    "name": "Nguyen Van A",
    "email": "abc@gmail.com",
    "role": "user",
    "isEmailVerified": true
  }
}
```

Cookie:

- accessToken (HttpOnly)

### Error

401

```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng"
}
```

403

```json
{
  "success": false,
  "message": "Email chưa được xác thực. Vui lòng kiểm tra email của bạn."
}
```

---

## GET /api/auth/verify-email

### Request

Query params:

```text
token=verification_token
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Error

400

```json
{
  "success": false,
  "message": "Invalid or expired verification token"
}
```

---

## POST /api/auth/resend-verification

### Request

```json
{
  "email": "abc@gmail.com"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

### Error

404

```json
{
  "success": false,
  "message": "User not found"
}
```

---

## POST /api/auth/forgot-password

### Request

```json
{
  "email": "abc@gmail.com"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "If the email exists, a reset link has been sent"
}
```

### Error

400

```json
{
  "success": false,
  "message": "Validation error."
}
```

---

## POST /api/auth/reset-password

### Request

```json
{
  "token": "reset_token",
  "password": "newPassword123",
  "confirmPassword": "newPassword123"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Error

400

```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

## POST /api/auth/change-password

### Request

```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newPassword123",
  "confirmPassword": "newPassword123"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

### Error

400

```json
{
  "success": false,
  "message": "Old password is incorrect"
}
```

401

```json
{
  "success": false,
  "message": "Authorization token is required."
}
```

---

## POST /api/auth/google

### Request

```json
{
  "idToken": "google_id_token"
}
```

### Success Response

Status: 200

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "token": "jwt_token",
  "user": {
    "id": "...",
    "name": "Google User",
    "email": "abc@gmail.com",
    "role": "user",
    "isEmailVerified": true
  }
}
```

Cookie:

- accessToken (HttpOnly)

### Error

400

```json
{
  "success": false,
  "message": "Google email is not verified"
}
```
