// pngjs não distribui declaração de tipo própria (sem "types"/"typings" no package.json,
// sem .d.ts). Combinado com jsconfig.json (maxNodeModuleJsDepth: 0), isso evita o TS cair
// pro .js fonte da lib como fallback (checkJs) e reportar dezenas de erro de um arquivo
// que não é nosso pra corrigir — PNG fica tipado como `any` puro.
declare module "pngjs";
