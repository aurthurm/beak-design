import type { Vertices } from "@highagency/pencil-skia";
import type { MeshGradientPoint } from "../canvas";
import type { Resolved } from "../managers/variable-manager";
import { hexToUint32, Skia } from "../skia";
import { cubicBezierPatch, smoothstep } from "../utils/math";

export function generateMeshGradientVertices(
  tessellation: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
  meshData: Resolved<MeshGradientPoint[]>,
): Vertices | undefined {
  const patchCountX = columns - 1;
  const patchCountY = rows - 1;
  const totalVertsX = patchCountX * tessellation + 1;
  const totalVertsY = patchCountY * tessellation + 1;
  const totalVerts = totalVertsX * totalVertsY;

  const positions = new Float32Array(totalVerts * 2);
  const colors = new Uint32Array(totalVerts);

  const parsedColor = meshData.map((pt) => {
    return hexToUint32(pt.color);
  });

  for (let patchRow = 0; patchRow < patchCountY; patchRow++) {
    for (let patchCol = 0; patchCol < patchCountX; patchCol++) {
      const i00 = patchRow * columns + patchCol;
      const i10 = patchRow * columns + patchCol + 1;
      const i01 = (patchRow + 1) * columns + patchCol;
      const i11 = (patchRow + 1) * columns + patchCol + 1;

      const p00 = meshData[i00];
      const p10 = meshData[i10];
      const p01 = meshData[i01];
      const p11 = meshData[i11];

      const c00 = parsedColor[i00];
      const c10 = parsedColor[i10];
      const c01 = parsedColor[i01];
      const c11 = parsedColor[i11];

      // NOTE(sedivy): Build 16 control points for a bicubic
      // Bezier patch from the 4 corner points and their handles.
      const P00x = p00.position[0];
      const P00y = p00.position[1];
      const P03x = p10.position[0];
      const P03y = p10.position[1];
      const P30x = p01.position[0];
      const P30y = p01.position[1];
      const P33x = p11.position[0];
      const P33y = p11.position[1];

      const P01x = P00x + p00.rightHandle[0];
      const P01y = P00y + p00.rightHandle[1];
      const P02x = P03x + p10.leftHandle[0];
      const P02y = P03y + p10.leftHandle[1];

      const P31x = P30x + p01.rightHandle[0];
      const P31y = P30y + p01.rightHandle[1];
      const P32x = P33x + p11.leftHandle[0];
      const P32y = P33y + p11.leftHandle[1];

      const P10x = P00x + p00.bottomHandle[0];
      const P10y = P00y + p00.bottomHandle[1];
      const P20x = P30x + p01.topHandle[0];
      const P20y = P30y + p01.topHandle[1];

      const P13x = P03x + p10.bottomHandle[0];
      const P13y = P03y + p10.bottomHandle[1];
      const P23x = P33x + p11.topHandle[0];
      const P23y = P33y + p11.topHandle[1];

      const P11x = P01x + P10x - P00x;
      const P11y = P01y + P10y - P00y;
      const P12x = P02x + P13x - P03x;
      const P12y = P02y + P13y - P03y;
      const P21x = P31x + P20x - P30x;
      const P21y = P31y + P20y - P30y;
      const P22x = P32x + P23x - P33x;
      const P22y = P32y + P23y - P33y;

      for (let ly = 0; ly <= tessellation; ly++) {
        for (let lx = 0; lx <= tessellation; lx++) {
          if (patchCol > 0 && lx === 0) continue;
          if (patchRow > 0 && ly === 0) continue;

          const u = ly / tessellation;
          const v = lx / tessellation;

          // biome-ignore format: arguments
          const px = cubicBezierPatch(
            P00x, P01x, P02x, P03x,
            P10x, P11x, P12x, P13x,
            P20x, P21x, P22x, P23x,
            P30x, P31x, P32x, P33x,
            u, v,
          );

          // biome-ignore format: arguments
          const py = cubicBezierPatch(
            P00y, P01y, P02y, P03y,
            P10y, P11y, P12y, P13y,
            P20y, P21y, P22y, P23y,
            P30y, P31y, P32y, P33y,
            u, v,
          );

          const globalX = patchCol * tessellation + lx;
          const globalY = patchRow * tessellation + ly;
          const vi = globalY * totalVertsX + globalX;

          const su = smoothstep(u);
          const sv = smoothstep(v);
          const su1 = 1 - su;
          const sv1 = 1 - sv;

          const w00 = su1 * sv1;
          const w10 = su1 * sv;
          const w01 = su * sv1;
          const w11 = su * sv;

          const cr =
            w00 * ((c00 >>> 24) & 0xff) +
            w10 * ((c10 >>> 24) & 0xff) +
            w01 * ((c01 >>> 24) & 0xff) +
            w11 * ((c11 >>> 24) & 0xff);

          const cg =
            w00 * ((c00 >>> 16) & 0xff) +
            w10 * ((c10 >>> 16) & 0xff) +
            w01 * ((c01 >>> 16) & 0xff) +
            w11 * ((c11 >>> 16) & 0xff);

          const cb =
            w00 * ((c00 >>> 8) & 0xff) +
            w10 * ((c10 >>> 8) & 0xff) +
            w01 * ((c01 >>> 8) & 0xff) +
            w11 * ((c11 >>> 8) & 0xff);

          const ca =
            w00 * ((c00 >>> 0) & 0xff) +
            w10 * ((c10 >>> 0) & 0xff) +
            w01 * ((c01 >>> 0) & 0xff) +
            w11 * ((c11 >>> 0) & 0xff);

          positions[vi * 2 + 0] = px * width;
          positions[vi * 2 + 1] = py * height;

          colors[vi] = ((ca << 24) | (cr << 16) | (cg << 8) | (cb << 0)) >>> 0;
        }
      }
    }
  }

  const indices: number[] = [];

  // NOTE(sedivy): Build triangle strip indices with
  // degenerate triangles between rows to render the
  // entire mesh in a single draw call
  for (let gy = 0; gy < totalVertsY - 1; gy++) {
    if (gy > 0) {
      indices.push(gy * totalVertsX);
    }

    for (let gx = 0; gx < totalVertsX; gx++) {
      const top = gy * totalVertsX + gx;
      const bottom = top + totalVertsX;
      indices.push(top, bottom);
    }

    if (gy < totalVertsY - 2) {
      indices.push((gy + 1) * totalVertsX + (totalVertsX - 1));
    }
  }

  return Skia.MakeVertices(
    Skia.VertexMode.TrianglesStrip,
    positions,
    null,
    colors,
    indices,
    true,
  );
}
