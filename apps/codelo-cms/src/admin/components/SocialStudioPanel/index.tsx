import * as React from "react";
import { Button, Flex, Typography } from "@strapi/design-system";
import { Magic, Images } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useNavigate } from "react-router-dom";

interface SidePanelProps {
  model?: string;
  documentId?: string;
}

type PanelDescriptor = { title: string; content: React.ReactNode } | null;

// Panel del editor de notas con dos acciones:
//  1) "Generar portada (IA)" — regen rápida estilo Director: usa el prompt con
//     memoria, genera y aplica el coverImage de la nota (fire-and-forget).
//  2) "Abrir Social Studio" — flujo interactivo para contenido de RRSS
//     descargable (carrusel / historia / reel) con preview editable.
export default function SocialStudioPanel({ model, documentId }: SidePanelProps): PanelDescriptor {
  /* eslint-disable react-hooks/rules-of-hooks */
  const navigate = useNavigate();
  const { post, get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [loading, setLoading] = React.useState(false);
  const [agentAvailable, setAgentAvailable] = React.useState<boolean | null>(null);

  const isPost = model === "api::post.post" && Boolean(documentId);

  React.useEffect(() => {
    if (!isPost) return;
    get("/api/agent/image-generator")
      .then(() => setAgentAvailable(true))
      .catch(() => setAgentAvailable(false));
  }, [isPost, get]);
  /* eslint-enable react-hooks/rules-of-hooks */

  if (!isPost) return null;

  async function generateCover() {
    setLoading(true);
    try {
      await post("/api/post/generate-cover", { documentId });
      toggleNotification({ type: "success", message: "Generando portada en segundo plano…" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al generar la portada.";
      toggleNotification({ type: "danger", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return {
    title: "Contenido IA",
    content: (
      <Flex direction="column" gap={2} paddingTop={2}>
        <Button
          variant="secondary"
          startIcon={<Magic />}
          loading={loading}
          onClick={generateCover}
          disabled={agentAvailable !== true}
          fullWidth
        >
          Generar portada (IA)
        </Button>
        {agentAvailable === false ? (
          <Typography variant="pi" textColor="neutral500" textAlign="center">
            Configurá un agente generador de imágenes para habilitar la portada.
          </Typography>
        ) : (
          <Typography variant="pi" textColor="neutral500" textAlign="center">
            Portada de la nota (estilo Director): prompt con memoria, se aplica directo.
          </Typography>
        )}

        <Button
          variant="tertiary"
          startIcon={<Images />}
          fullWidth
          onClick={() => navigate(`/social-studio?post=${documentId}`)}
        >
          Abrir Social Studio
        </Button>
        <Typography variant="pi" textColor="neutral500" textAlign="center">
          Carruseles, historias y reels descargables — con preview editable.
        </Typography>
      </Flex>
    ),
  };
}
