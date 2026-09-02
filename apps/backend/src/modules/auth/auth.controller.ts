import { Controller, Post, Get, Body, HttpCode, HttpStatus, Headers, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsNotEmpty, IsString, IsEmail, MinLength, IsOptional } from "class-validator";

export class ValidateSsoDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  organizationName?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  getMe(@Headers("authorization") authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException("Authorization header required.");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const session = this.authService.validateSsoToken(token);
    return {
      success: true,
      session,
    };
  }

  @Post("sso-validate")
  @HttpCode(HttpStatus.OK)
  validateSso(@Body() dto: ValidateSsoDto) {
    const session = this.authService.validateSsoToken(dto.token);
    return {
      success: true,
      message: "SSO token validated successfully",
      session,
    };
  }
}
