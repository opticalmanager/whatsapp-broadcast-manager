import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsNotEmpty, IsString } from "class-validator";

export class ValidateSsoDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
