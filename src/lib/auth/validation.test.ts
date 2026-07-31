import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema, resetPasswordSchema } from "./validation";

describe("auth validation", () => {
  it("normaliza e-mail no login", () => {
    const result = loginSchema.parse({
      email: "  DONO@IMOBILIARIA.COM ",
      password: "senha",
    });
    expect(result.email).toBe("dono@imobiliaria.com");
  });

  it("exige senha forte no cadastro", () => {
    const result = registerSchema.safeParse({
      fullName: "Dono da Operação",
      email: "dono@imobiliaria.com",
      password: "curta",
    });
    expect(result.success).toBe(false);
  });

  it("exige confirmação idêntica ao redefinir senha", () => {
    const result = resetPasswordSchema.safeParse({
      password: "SenhaForte123",
      confirmPassword: "SenhaDiferente123",
    });
    expect(result.success).toBe(false);
  });
});
