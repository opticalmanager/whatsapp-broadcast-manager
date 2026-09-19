import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SaveWabaConfigDto {
  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;

  @IsString()
  @IsNotEmpty()
  wabaId: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsString()
  @IsNotEmpty()
  webhookVerifyToken: string;

  @IsString()
  @IsOptional()
  appId?: string;
}

export class TestWabaConnectionDto {
  @IsString()
  @IsOptional()
  phoneNumberId?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}
