import { Button, Heading, LifePathHero, Meta, Pill, Row, Screen, ScreenFooter, ScreenHeader, Stack, Tag, Text } from "@/shared/ui";

export function Inicio({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <Screen>
      <ScreenHeader left={<Pill>Simulador de vida</Pill>} right={<Meta>BiforkStrange</Meta>} />
      <LifePathHero past={["Estudios", "Primera pega"]} today="Tú, hoy" chosen="Emprender" alternatives={["Startup", "Magíster"]} />
      <Stack gap={12}>
        <Heading level={1}>Juega tu carrera antes de vivirla.</Heading>
        <Text>Diez temporadas de tu carrera en tres minutos. Cada año te llegan ofertas de empresas reales de Chile; tú eliges, los datos deciden qué pasa después.</Text>
      </Stack>
      <Row gap={6}>
        <Tag>10 temporadas en 3 minutos</Tag>
        <Tag>Empresas reales</Tag>
        <Tag>Datos de Chile</Tag>
      </Row>
      <ScreenFooter>
        <Button onClick={onEmpezar}>Empezar mi carrera</Button>
      </ScreenFooter>
    </Screen>
  );
}
