import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 para o app no celular alcançar a API pela rede local
  await app.listen(port, '0.0.0.0');
  console.log(`NetPoint API rodando em http://localhost:${port}/api`);
}
bootstrap();
