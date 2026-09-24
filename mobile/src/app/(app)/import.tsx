import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ImportReport } from '@/api/types';
import { spacing, useTheme } from '@/theme';
import { Badge, Body, Button, Card, Row, Screen, SectionTitle, Title, notify } from '@/components/ui';
import { downloadAndShare } from '@/lib/download';

type Picked = DocumentPicker.DocumentPickerAsset;

function toForm(file: Picked) {
  const form = new FormData();
  if (Platform.OS === 'web' && file.file) form.append('file', file.file);
  // No React Native, o FormData aceita { uri, name, type } para enviar arquivos
  else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  return form;
}

/**
 * Importação por planilha em duas etapas:
 * 1) validar (nada é gravado) → 2) importar, somente se não houver erros.
 */
export default function ImportScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [file, setFile] = useState<Picked | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<'validate' | 'apply' | 'template' | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    setFile(res.assets[0]);
    setReport(null);
    run(res.assets[0], false);
  };

  const run = async (f: Picked, apply: boolean) => {
    setBusy(apply ? 'apply' : 'validate');
    try {
      const r = await api<ImportReport>('/excel/import', { method: 'POST', query: { apply: apply ? 'true' : 'false' }, form: toForm(f) });
      setReport(r);
      if (r.applied) {
        qc.invalidateQueries();
        notify('Importação concluída', 'Os dados já estão disponíveis no aplicativo.');
      }
    } catch (e) {
      notify('Falha na importação', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const template = async () => {
    setBusy('template');
    try {
      await downloadAndShare('/excel/template', 'netpoint-modelo-importacao.xlsx');
    } catch (e) {
      notify('Erro', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const s = report?.summary;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Importar planilha' }} />

      <Card style={{ gap: spacing.md }}>
        <Body bold size={16}>
          1. Baixe a planilha padrão
        </Body>
        <Body muted>Ela tem as abas “Equipamentos” e “Pontos de Rede”, com um exemplo preenchido e instruções.</Body>
        <Button title="Baixar modelo" icon="download" variant="secondary" onPress={template} loading={busy === 'template'} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Body bold size={16}>
          2. Envie a planilha preenchida
        </Body>
        <Body muted>O NetPoint valida tudo antes de gravar. Nada é alterado até você confirmar.</Body>
        <Button title={file ? `Trocar arquivo (${file.name})` : 'Escolher arquivo .xlsx'} icon="file-excel-outline" onPress={pick} loading={busy === 'validate'} />
      </Card>

      {report && s && (
        <>
          <SectionTitle>Resultado da validação</SectionTitle>
          <Card style={{ gap: spacing.sm, backgroundColor: report.valid ? colors.successSoft : colors.dangerSoft, borderWidth: 0 }}>
            <Row>
              <Badge label={report.applied ? 'Importado' : report.valid ? 'Pronto para importar' : `${report.errors.length} erro(s)`} color={report.valid ? colors.success : colors.danger} />
            </Row>
            <Title size={18}>
              {s.devicesToCreate + s.devicesToUpdate} equipamentos · {s.pointsToCreate + s.pointsToUpdate} pontos
            </Title>
            <Body>
              Novos: {s.devicesToCreate} equipamentos, {s.pointsToCreate} pontos{'\n'}Atualizados: {s.devicesToUpdate} equipamentos, {s.pointsToUpdate} pontos
            </Body>
            {!!s.departmentsToCreate.length && <Body>Setores a criar: {s.departmentsToCreate.join(', ')}</Body>}
            {!!s.roomsToCreate.length && <Body>Salas a criar: {s.roomsToCreate.join(', ')}</Body>}
          </Card>

          {report.errors.map((e, i) => (
            <Card key={`e${i}`} style={{ padding: spacing.md, borderLeftWidth: 5, borderLeftColor: colors.danger }}>
              <Body muted size={12}>
                {e.sheet} · linha {e.row}
              </Body>
              <Body bold>{e.message}</Body>
            </Card>
          ))}
          {report.warnings.map((w, i) => (
            <Card key={`w${i}`} style={{ padding: spacing.md, borderLeftWidth: 5, borderLeftColor: colors.warning }}>
              <Body muted size={12}>
                {w.sheet} · linha {w.row}
              </Body>
              <Body>{w.message}</Body>
            </Card>
          ))}

          <View style={{ gap: spacing.sm }}>
            {report.valid && !report.applied && file && (
              <Button title="3. Importar agora" icon="database-import-outline" onPress={() => run(file, true)} loading={busy === 'apply'} />
            )}
            {!report.valid && <Body muted>Corrija os erros na planilha e envie novamente.</Body>}
            {report.applied && <Button title="Ver equipamentos" icon="desktop-classic" variant="secondary" onPress={() => router.push('/devices')} />}
          </View>
        </>
      )}
    </Screen>
  );
}
