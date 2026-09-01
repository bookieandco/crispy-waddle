import { describe, expect, it } from "vitest";
import { demoProducts } from "./index";

describe("pod product definitions", () => {
  it("keeps printable surfaces independent from renderer details", () => {
    const tee = demoProducts.find((product) => product.id === "classic-tee");
    expect(tee).toBeDefined();
    expect(tee?.surfaces[0]).toMatchObject({
      id: "front",
      widthMm: 305,
      heightMm: 406,
    });
    expect(tee?.model).not.toHaveProperty("mesh");
  });

  it("supports provider variant mapping without coupling the storefront to Printify", () => {
    const hoodie = demoProducts.find((product) => product.id === "classic-hoodie");
    expect(hoodie?.variants[0]).toHaveProperty("id");
    expect(hoodie?.provider?.name).toBeUndefined();
  });
});
