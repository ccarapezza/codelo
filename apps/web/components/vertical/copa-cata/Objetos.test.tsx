// Los objetos de la Copa: cada uno es un botón que abre el visor, se recorre
// con el teclado y devuelve el foco al objeto que se estaba viendo. La
// inclinación la escribe el mouse en cuatro variables CSS; el dedo y el
// movimiento reducido no la tocan. Lo que se prueba es el contrato, no el
// aspecto (ese se mira en el navegador).

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjetoEnlace, Objetos, type ItemObjeto } from "./Objetos";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// El Link del sitio antepone el idioma; acá alcanza con un <a>.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...resto }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/es${href}`} {...resto}>
      {children}
    </a>
  ),
}));

const ETIQUETAS = {
  lista: "De mano en mano",
  item: "Pieza {n} de {total}",
  anterior: "Anterior",
  siguiente: "Siguiente",
  cerrar: "Cerrar",
};

const CREDENCIAL: ItemObjeto = {
  src: "/copa-cata/2014/2014-credencial-participante.webp",
  width: 951,
  height: 1177,
  alt: "Credencial de prueba de fondo negro",
  tipo: "credencial",
  material: "plastico",
  rotulo: "Credencial · Socio participante",
};
const INVITADO: ItemObjeto = {
  ...CREDENCIAL,
  src: "/copa-cata/2014/2014-credencial-invitado.webp",
  alt: "Credencial de prueba de fondo blanco",
  rotulo: "Credencial · Socio/Invitado",
};
const ROTULO: ItemObjeto = {
  src: "/copa-cata/2014/2014-rotulo-muestra.webp",
  width: 662,
  height: 333,
  alt: "Rótulo de prueba de una muestra",
  tipo: "rotulo",
  material: "adhesivo",
  rotulo: "Rótulo de muestra",
};
const ITEMS = [CREDENCIAL, INVITADO, ROTULO];

/** Las cuatro variables que escribe el mouse, leídas del estilo en línea. */
const variables = (el: HTMLElement) =>
  Object.fromEntries(["--rx", "--ry", "--gx", "--gy"].map((v) => [v, el.style.getPropertyValue(v)]));

/** Simula el sistema: `reduce` = movimiento reducido. */
function sistema(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }),
  );
}

beforeEach(() => {
  // Un cuadro por llamada, al instante: la escritura no espera al navegador.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  sistema(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Mide la escena del objeto como si estuviera dibujada: 240×320 en (100, 200). */
function medir(boton: HTMLElement) {
  const escena = boton.querySelector(".objeto-escena") as HTMLElement;
  escena.getBoundingClientRect = () =>
    ({ left: 100, top: 200, width: 240, height: 320, right: 340, bottom: 520, x: 100, y: 200, toJSON() {} }) as DOMRect;
}

describe("Objetos", () => {
  it("es una lista con nombre; cada objeto es un botón que abre el visor, con su imagen y su rótulo", () => {
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    expect(screen.getByRole("list", { name: "De mano en mano" })).toBeInTheDocument();
    const botones = screen.getAllByRole("button");
    expect(botones).toHaveLength(3);
    for (const b of botones) expect(b).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByRole("button", { name: /fondo negro.*Socio participante/ })).toHaveAttribute(
      "data-material",
      "plastico",
    );
  });

  it("solo lo plastificado lleva cordón, ranura y gancho", () => {
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    const [credencial, , rotulo] = screen.getAllByRole("button");
    for (const clase of ["objeto-cordon", "objeto-ranura", "objeto-gancho"]) {
      expect(credencial.querySelector(`.${clase}`), clase).not.toBeNull();
      expect(rotulo.querySelector(`.${clase}`), clase).toBeNull();
    }
  });

  it("el cartón (el identificador de mesa) tampoco cuelga, y lleva su material", () => {
    const mesa: ItemObjeto = {
      src: "/copa-cata/2021/2021-mesa-sponsors.webp",
      width: 1039,
      height: 1600,
      alt: "Identificador de prueba de una mesa",
      tipo: "identificador-mesa",
      material: "carton",
      rotulo: "Identificador de mesa · Sponsors",
    };
    render(<Objetos items={[mesa]} etiquetas={ETIQUETAS} />);
    const boton = screen.getByRole("button", { name: /Identificador de prueba/ });
    expect(boton).toHaveAttribute("data-material", "carton");
    expect(boton.querySelector(".objeto-cordon")).toBeNull();
  });

  it("una credencial de papel (la tarjeta de 2022) no cuelga: sin cordón, ranura ni gancho", () => {
    const tarjeta: ItemObjeto = {
      ...CREDENCIAL,
      src: "/copa-cata/2022/2022-credencial.webp",
      width: 1200,
      height: 796,
      alt: "Credencial de prueba de papel",
      material: "papel",
      rotulo: "Credencial · Participante",
    };
    render(<Objetos items={[tarjeta]} etiquetas={ETIQUETAS} />);
    const boton = screen.getByRole("button", { name: /de papel/ });
    expect(boton).toHaveAttribute("data-material", "papel");
    for (const clase of ["objeto-cordon", "objeto-ranura", "objeto-gancho"]) {
      expect(boton.querySelector(`.${clase}`), clase).toBeNull();
    }
  });

  it("con el teclado: abre en el objeto elegido, ← y → recorren y Esc devuelve el foco al que se estaba viendo", async () => {
    const user = userEvent.setup();
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    const botones = screen.getAllByRole("button");

    await user.tab();
    await user.tab();
    expect(botones[1]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Pieza 2 de 3" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: INVITADO.alt })).toHaveAttribute("src", INVITADO.src);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Pieza 3 de 3" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(botones[2]).toHaveFocus());
  });

  it("el mouse inclina: escribe las cuatro variables y al salir las borra", () => {
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    const boton = screen.getAllByRole("button")[0];
    medir(boton);

    fireEvent.pointerMove(boton, { pointerType: "mouse", clientX: 100, clientY: 200 });
    expect(variables(boton)).toEqual({ "--rx": "9deg", "--ry": "-13deg", "--gx": "0", "--gy": "0" });
    expect(boton).toHaveAttribute("data-siguiendo");

    fireEvent.pointerLeave(boton, { pointerType: "mouse" });
    expect(variables(boton)).toEqual({ "--rx": "", "--ry": "", "--gx": "", "--gy": "" });
    expect(boton).not.toHaveAttribute("data-siguiendo");
  });

  it("el dedo no inclina: arrastrar es desplazar la página", () => {
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    const boton = screen.getAllByRole("button")[0];
    medir(boton);
    fireEvent.pointerMove(boton, { pointerType: "touch", clientX: 100, clientY: 200 });
    expect(variables(boton)["--rx"]).toBe("");
    expect(boton).not.toHaveAttribute("data-siguiendo");
  });

  it("con movimiento reducido el mouse tampoco inclina", () => {
    sistema(true);
    render(<Objetos items={ITEMS} etiquetas={ETIQUETAS} />);
    const boton = screen.getAllByRole("button")[0];
    medir(boton);
    fireEvent.pointerMove(boton, { pointerType: "mouse", clientX: 100, clientY: 200 });
    expect(variables(boton)["--rx"]).toBe("");
  });
});

describe("ObjetoEnlace", () => {
  it("es un enlace a la edición, con la imagen y el rótulo como nombre, y se inclina igual", () => {
    render(
      <ObjetoEnlace
        item={{ ...CREDENCIAL, rotulo: "1ª Copa · 2014" }}
        href="/copa-cata/2014"
        tamanio="176px"
      />,
    );
    const enlace = screen.getByRole("link", { name: /fondo negro.*1ª Copa · 2014/ });
    expect(enlace).toHaveAttribute("href", "/es/copa-cata/2014");
    medir(enlace);
    fireEvent.pointerMove(enlace, { pointerType: "mouse", clientX: 340, clientY: 520 });
    expect(variables(enlace)).toEqual({ "--rx": "-9deg", "--ry": "13deg", "--gx": "1", "--gy": "1" });
  });
});
