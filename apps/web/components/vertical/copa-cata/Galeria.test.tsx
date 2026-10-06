// El visor de la Copa se recorre con el teclado: abrir, ← y →, Esc, y el foco
// vuelve a la miniatura de la imagen que se estaba viendo. Lo que se prueba es
// el contrato de accesibilidad, no el aspecto.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Galeria, type ItemGaleria } from "./Galeria";
import { rotular } from "./Lightbox";

// next/image necesita la configuración de Next; acá alcanza con un <img>.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const ETIQUETAS = {
  lista: "La galería",
  item: "Foto {n} de {total}",
  anterior: "Anterior",
  siguiente: "Siguiente",
  cerrar: "Cerrar",
};

const foto = (n: number): ItemGaleria => ({
  src: `/cms/uploads/copa-cata-2019-00${n}.webp`,
  miniatura: `/cms/uploads/small_copa-cata-2019-00${n}.webp`,
  width: 1600,
  height: 1067,
  alt: `Mesa de evaluación número ${n}, sin personas`,
});

const FOTOS = [foto(1), foto(2), foto(3)];

describe("rotular", () => {
  it("completa la plantilla con la posición y el total", () => {
    expect(rotular("Foto {n} de {total}", 3, 24)).toBe("Foto 3 de 24");
  });
});

describe("Galeria + Lightbox", () => {
  it("abre en la foto elegida, recorre con ← y → en círculo y Esc devuelve el foco a la miniatura vista", async () => {
    const user = userEvent.setup();
    render(<Galeria items={FOTOS} variante="mosaico" etiquetas={ETIQUETAS} />);

    // El mosaico es una lista con nombre, y cada foto es un botón que abre el visor.
    expect(screen.getByRole("list", { name: "La galería" })).toBeInTheDocument();
    const miniaturas = screen.getAllByRole("button", { name: /Mesa de evaluación/ });
    expect(miniaturas).toHaveLength(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Abrir con el teclado: Tab hasta la segunda miniatura y Enter.
    await user.tab();
    await user.tab();
    expect(miniaturas[1]).toHaveFocus();
    await user.keyboard("{Enter}");

    const dialogo = await screen.findByRole("dialog", { name: "Foto 2 de 3" });
    expect(dialogo).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mesa de evaluación número 2, sin personas" })).toHaveAttribute(
      "src",
      "/cms/uploads/copa-cata-2019-002.webp",
    );

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Foto 3 de 3" })).toBeInTheDocument();

    // Después de la última vuelve a la primera.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Foto 1 de 3" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "Foto 3 de 3" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // El foco vuelve a la miniatura de la foto que se estaba viendo (la 3),
    // no a la que abrió el visor (la 2).
    await waitFor(() => expect(miniaturas[2]).toHaveFocus());
  });

  it("los botones Anterior y Siguiente también recorren, y Cerrar cierra", async () => {
    const user = userEvent.setup();
    render(<Galeria items={FOTOS} variante="mosaico" etiquetas={ETIQUETAS} />);

    await user.click(screen.getAllByRole("button", { name: /Mesa de evaluación/ })[0]);
    await screen.findByRole("dialog", { name: "Foto 1 de 3" });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("dialog", { name: "Foto 2 de 3" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("dialog", { name: "Foto 1 de 3" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("con una sola imagen no hay flechas y las teclas no la cambian", async () => {
    const user = userEvent.setup();
    const grafica: ItemGaleria = {
      src: "/copa-cata/2017/2017-afiche.webp",
      miniatura: "/copa-cata/2017/2017-afiche.webp",
      width: 1213,
      height: 1600,
      alt: "Afiche de la IV Copa",
      rotulo: "Afiche",
    };
    render(
      <Galeria
        items={[grafica]}
        variante="riel"
        etiquetas={{ ...ETIQUETAS, lista: "Afiches y piezas", item: "Gráfica {n} de {total}" }}
      />,
    );
    // En el riel, el rótulo de la pieza va debajo de la imagen.
    expect(screen.getByRole("list", { name: "Afiches y piezas" })).toHaveTextContent("Afiche");

    await user.click(screen.getByRole("button", { name: /Afiche de la IV Copa/ }));
    await screen.findByRole("dialog", { name: "Gráfica 1 de 1" });
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Gráfica 1 de 1" })).toBeInTheDocument();
    // Sin pie, la descripción del diálogo es el texto alternativo.
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Afiche de la IV Copa");
  });
});
