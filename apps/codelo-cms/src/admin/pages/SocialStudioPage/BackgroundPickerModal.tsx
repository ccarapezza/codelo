import * as React from "react";
import { Box, Button, Flex, Loader, Modal, Typography } from "@strapi/design-system";
import { Images } from "@strapi/icons";
import { useFetchClient } from "@strapi/strapi/admin";
import { EmptyState } from "../../components/ui";
import type { BackgroundFile } from "./types";

// Picker de fondos preexistentes de la carpeta "AI Backgrounds" del Media
// Library. Elegir uno saltea la generación IA (costo $0).
export default function BackgroundPickerModal({
  open,
  type,
  onClose,
  onPick,
}: {
  open: boolean;
  type: "image" | "video";
  onClose: () => void;
  onPick: (file: BackgroundFile) => void;
}) {
  const { get } = useFetchClient();
  const [files, setFiles] = React.useState<BackgroundFile[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFiles(null);
    get(`/api/social-studio/backgrounds?type=${type}`)
      .then(({ data }: { data: { files: BackgroundFile[] } }) => setFiles(data.files))
      .catch(() => setFiles([]));
  }, [open, type, get]);

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Typography variant="omega" fontWeight="bold">
            {type === "video" ? "Clips de video generados" : "Fondos generados"} — AI Backgrounds
          </Typography>
        </Modal.Header>
        <Modal.Body>
          {files === null ? (
            <Flex justifyContent="center" padding={6}>
              <Loader>Cargando fondos…</Loader>
            </Flex>
          ) : files.length === 0 ? (
            <EmptyState
              icon={<Images />}
              title="Todavía no hay fondos generados"
              description="Cuando generes contenido con IA, los fondos quedan guardados acá para reusarlos gratis."
            />
          ) : (
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPick(f)}
                  style={{
                    cursor: "pointer",
                    border: "1px solid transparent",
                    borderRadius: 8,
                    padding: 0,
                    background: "none",
                    textAlign: "left",
                    overflow: "hidden",
                  }}
                  title={f.name}
                >
                  <Box borderColor="neutral200" borderWidth="1px" borderStyle="solid" hasRadius style={{ overflow: "hidden" }}>
                    {f.mime.startsWith("video/") ? (
                      <video src={f.url} muted style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} />
                    ) : (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <img src={f.url} style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} />
                    )}
                    <Box padding={2}>
                      <Typography variant="pi" textColor="neutral600" ellipsis>
                        {f.name}
                      </Typography>
                    </Box>
                  </Box>
                </button>
              ))}
            </Box>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cerrar</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
