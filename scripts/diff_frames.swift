// Diffs two images and reports changed-pixel stats plus a bounding box.
// Usage: swift diff_frames.swift <a.jpg> <b.jpg> [out.png]
import AppKit

let args = CommandLine.arguments
guard args.count >= 3,
      let a = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: args[1]))),
      let b = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: args[2]))) else {
    print("usage: diff_frames.swift <a> <b> [out.png]")
    exit(1)
}
let w = min(a.pixelsWide, b.pixelsWide)
let h = min(a.pixelsHigh, b.pixelsHigh)
guard let pa = a.bitmapData, let pb = b.bitmapData else { exit(1) }
let (bra, spa) = (a.bytesPerRow, a.samplesPerPixel)
let (brb, spb) = (b.bytesPerRow, b.samplesPerPixel)

let out = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
    bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: w * 3, bitsPerPixel: 24)!
let po = out.bitmapData!

var changed = 0
var maxDiff = 0
var minX = w, minY = h, maxX = 0, maxY = 0
for y in 0..<h {
    for x in 0..<w {
        let oa = y * bra + x * spa
        let ob = y * brb + x * spb
        var d = 0
        for c in 0..<3 { d = max(d, abs(Int(pa[oa + c]) - Int(pb[ob + c]))) }
        let oo = y * w * 3 + x * 3
        let v = UInt8(min(d * 4, 255))
        po[oo] = v; po[oo + 1] = v; po[oo + 2] = v
        if d > 12 {
            changed += 1
            maxDiff = max(maxDiff, d)
            minX = min(minX, x); maxX = max(maxX, x)
            minY = min(minY, y); maxY = max(maxY, y)
        }
    }
}
print("changed pixels (>12): \(changed) / \(w * h)  maxDiff=\(maxDiff)")
if changed > 0 { print("bbox: x \(minX)-\(maxX), y \(minY)-\(maxY)  (image \(w)x\(h))") }
if args.count > 3, let png = out.representation(using: .png, properties: [:]) {
    try png.write(to: URL(fileURLWithPath: args[3]))
    print("wrote \(args[3])")
}
