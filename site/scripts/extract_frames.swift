// Extracts frames from a video at a fixed interval using AVFoundation.
// Usage: swift extract_frames.swift <video> <outdir> <fps> [maxFrames]
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 4 else {
    print("usage: extract_frames.swift <video> <outdir> <fps> [maxFrames]")
    exit(1)
}
let url = URL(fileURLWithPath: args[1])
let outDir = args[2]
let fps = Double(args[3]) ?? 4
let maxFrames = args.count > 4 ? Int(args[4]) ?? 200 : 200

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let duration = CMTimeGetSeconds(asset.duration)
print("duration: \(duration)s")

let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 1280, height: 1280)

var t = 0.0
var i = 0
while t < duration && i < maxFrames {
    let time = CMTime(seconds: t, preferredTimescale: 600)
    do {
        let cg = try gen.copyCGImage(at: time, actualTime: nil)
        let rep = NSBitmapImageRep(cgImage: cg)
        if let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) {
            let name = String(format: "frame_%04d_t%.2f.jpg", i, t)
            try data.write(to: URL(fileURLWithPath: "\(outDir)/\(name)"))
        }
        // mean brightness for flicker detection
        var sum = 0.0, count = 0.0
        if let px = rep.bitmapData {
            let bpr = rep.bytesPerRow, spp = rep.samplesPerPixel
            let h = rep.pixelsHigh, w = rep.pixelsWide
            var y = 0
            while y < h {
                var x = 0
                while x < w {
                    let o = y * bpr + x * spp
                    sum += Double(px[o]) + Double(px[o + 1]) + Double(px[o + 2])
                    count += 3
                    x += 16
                }
                y += 16
            }
        }
        print(String(format: "frame %d t=%.2f brightness=%.1f", i, t, sum / max(count, 1)))
    } catch {
        print("frame \(i) t=\(t) failed: \(error.localizedDescription)")
    }
    t += 1.0 / fps
    i += 1
}
print("done: \(i) frames")
