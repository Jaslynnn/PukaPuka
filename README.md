# Puka Puka

An interactive audio-visual installation built with p5.js and ml5.js, inspired by the island of Puka Puka as described in Judith Schalansky's *Atlas of Remote Islands: Fifty Islands I Have Never Set Foot On and Never Will*.

---

## The Island

In Schalansky's atlas, Puka Puka — also known as Danger Island — is a place of paradox. It is impossibly remote, achingly beautiful, and quietly threatening. Schalansky writes about islands not as destinations but as ideas: places where human longing, violence, tenderness, and isolation collide and cannot be separated from one another. Puka Puka holds all of that at once. The warmth of the Pacific light and the danger underneath it. The togetherness of a small community enclosed by open water, and the tension that closeness inevitably breeds.

This piece tries to sit inside that paradox.

---

## The Work

A live camera feed processes the bodies of people in the space through a field of moving dots. The dots follow the edges of whatever the camera sees — tracing bodies, hands, faces — pulled along by the contours of the image like particles caught in a current. As more people enter the frame, the dots grow larger and more agitated, the field thickening around them.

The dots are the danger part of Puka Puka. There is something unsettling about watching yourself rendered as a swarm, about the way the particles cling to your outline and follow you without quite being you. The visual does not mirror you — it reads you, and what it gives back feels slightly wrong, slightly alive.

At the same time, the sound tells a different story. Each person who enters the space adds a new audio layer — their own track, shaped by how they move. Their position in space shifts the stereo field. Their speed changes the pitch. When two people draw close to each other, the tracks do not clash — they accelerate gently together, a small harmonic nudge. When someone leaves, their track fades out.

The sound is the togetherness of Puka Puka. Separate voices that become one texture. The harmony does not resolve the tension — it holds it. The dots and the music are working against each other and alongside each other at the same time, which is what the island does too.

---

## Running the Piece

Because the piece loads an object detection model from ml5.js, it must be served over HTTP — opening the HTML file directly in a browser will not work.

From inside the `p5js-setup` folder, run:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

Once the page loads:
- Allow camera access when prompted
- Wait for **"Model ready"** to appear in the top-left corner
- **Click anywhere** to unlock audio
- Step into frame

Up to four people can be tracked simultaneously.

---

## Technical Notes

- **Object detection**: ml5.js COCO-SSD running in the browser, no server required
- **Visual**: A particle grid driven by Sobel-like edge detection — dots are pulled along image contours by the gradient of the video frame
- **Audio**: Web Audio API with per-body stereo panning, pitch modulation by movement speed, and volume mapped to distance from the camera
- **Background track**: streams continuously; four additional tracks layer in as people enter the frame
- **Color scheme**: deep ocean palette — lagoon blue, warm sand, palm green, coral — with a sunset orange tint when bodies are in proximity

---

*Judith Schalansky, Atlas of Remote Islands: Fifty Islands I Have Never Set Foot On and Never Will (2010)*
