import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("BroadcastBackend");
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      "https://broadcasting.opticalmanager.in",
      "https://www.opticalmanager.in",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`OpticalManager Broadcast Backend API running on port ${port}`);
}

bootstrap();
