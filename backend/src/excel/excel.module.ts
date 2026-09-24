import { BadRequestException, Controller, Get, Module, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminOnly, AuthUser, CurrentUser } from '../common/auth';
import { ExcelExportService } from './excel-export.service';
import { ExcelImportService } from './excel-import.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

@AdminOnly()
@Controller('excel')
class ExcelController {
  constructor(private readonly exporter: ExcelExportService, private readonly importer: ExcelImportService) {}

  /** Inventário completo: Equipamentos, Pontos de Rede, Switches e Mapeamento de Portas. */
  @Get('export')
  async export(@Res() res: Response) {
    const date = new Date().toISOString().slice(0, 10);
    sendXlsx(res, await this.exporter.inventory(), `netpoint-inventario-${date}.xlsx`);
  }

  @Get('template')
  async template(@Res() res: Response) {
    sendXlsx(res, await this.importer.template(), 'netpoint-modelo-importacao.xlsx');
  }

  /**
   * Importa a planilha padrão. Com `apply=false` (padrão) apenas valida e devolve o relatório;
   * com `apply=true` grava tudo em uma única transação, se não houver erros.
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async import(@UploadedFile() file: Express.Multer.File, @Query('apply') apply: string, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('Envie o arquivo no campo "file"');
    return this.importer.import(file.buffer, apply === 'true', user);
  }
}

@Module({ controllers: [ExcelController], providers: [ExcelExportService, ExcelImportService] })
export class ExcelModule {}
