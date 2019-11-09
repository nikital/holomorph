import {parse, derivative, complex, add, multiply} from "mathjs"

interface Graph {
    comp: CanvasRenderingContext2D
    graph: CanvasRenderingContext2D
}

interface State {
    fRaw: string
    // Derived from fRaw
    f: math.EvalFunction
    df: math.EvalFunction

    inputs: (math.Complex | null)[]
    // Derived from inputs and fRaw
    outputs: (math.Complex | null)[]
    derivative: math.Complex | null

    scaleSrc: number
    scaleDst: number

    mouseDown: boolean
};

function initState(fRaw: string, scaleSrc: number, scaleDst: number): State {
    const f = parse (fRaw)
    return {
        fRaw,
        f: f.compile (),
        df: derivative (f, "z").compile (),
        inputs: [],
        outputs: [],
        derivative: null,
        scaleSrc, scaleDst,
        mouseDown: false,
    }
}

let state: State = initState ("e^z", 5, 80)

function initCanvas (id: string): Graph {
    const compElem = document.getElementById (id) as HTMLCanvasElement,
    graphElem = document.createElement ("canvas"),
    comp = compElem.getContext ("2d")!,
    graph = graphElem.getContext ("2d")!,
    bounds = compElem.getBoundingClientRect ()

    compElem.width = bounds.width
    compElem.height = bounds.height
    graphElem.width = bounds.width
    graphElem.height = bounds.height

    return {comp, graph}
}

const src = initCanvas ("src")
const dst = initCanvas ("dst")

function mouseToComplex (x: number, y: number): math.Complex {
    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    srcOffsetX = srcWidth >> 1,
    srcOffsetY = srcHeight >> 1,
    srcScale = srcWidth / state.scaleSrc

    return complex((x-srcOffsetX) / srcScale, (y-srcOffsetY) / -srcScale)
}

function addInput (z: math.Complex | null) {
    if (z == null) {
        state.inputs.push (null)
        state.outputs.push (null)
        state.derivative = null
        return
    }
    const fz = state.f.evaluate ({z})
    const dz = state.df.evaluate ({z})
    state.inputs.push (z)
    state.outputs.push (fz)
    state.derivative = dz
}

interface Scale {
    srcScale: number
    dstScale: number
}

function setTransform(): Scale {
    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    dstWidth = dst.graph.canvas.width,
    dstHeight = dst.graph.canvas.height,
    srcOffsetX = srcWidth >> 1,
    srcOffsetY = srcHeight >> 1,
    dstOffsetX = dstWidth >> 1,
    dstOffsetY = dstHeight >> 1,
    srcScale = srcWidth / state.scaleSrc,
    dstScale = dstWidth / state.scaleDst

    src.graph.setTransform(srcScale, 0, 0, -srcScale, srcOffsetX, srcOffsetY)
    src.graph.lineWidth = 1/srcScale
    src.comp.setTransform(srcScale, 0, 0, -srcScale, srcOffsetX, srcOffsetY)
    src.comp.lineWidth = 1/srcScale
    dst.graph.setTransform(dstScale, 0, 0, -dstScale, dstOffsetX, dstOffsetY)
    dst.graph.lineWidth = 1/dstScale
    dst.comp.setTransform(dstScale, 0, 0, -dstScale, dstOffsetX, dstOffsetY)
    dst.comp.lineWidth = 1/dstScale

    return {srcScale, dstScale}
}

function drawGraphFull () {
    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    dstWidth = dst.graph.canvas.width,
    dstHeight = dst.graph.canvas.height

    src.graph.setTransform(1, 0, 0, 1, 0, 0)
    dst.graph.setTransform(1, 0, 0, 1, 0, 0)
    src.graph.clearRect (0, 0, srcWidth, srcHeight)
    dst.graph.clearRect (0, 0, dstWidth, dstWidth)

    const {srcScale, dstScale} = setTransform ()

    // Axis
    src.graph.beginPath ()
    src.graph.moveTo (-srcWidth/srcScale, 0)
    src.graph.lineTo (srcWidth/srcScale, 0)
    src.graph.moveTo (0, -srcHeight/srcScale)
    src.graph.lineTo (0, srcHeight/srcScale)
    src.graph.stroke ()

    dst.graph.beginPath ()
    dst.graph.moveTo (-dstWidth/dstScale, 0)
    dst.graph.lineTo (dstWidth/dstScale, 0)
    dst.graph.moveTo (0, -dstHeight/dstScale)
    dst.graph.lineTo (0, dstHeight/dstScale)
    dst.graph.stroke ()

    // Grid
    const resolution = 50 / srcScale,
    steps = 10,
    gridWidth = srcWidth/srcScale/2,
    gridHeight = srcHeight/srcScale/2,
    gridElementsX = Math.floor(gridWidth / resolution)+1,
    gridElementsY = Math.floor(gridHeight / resolution)+1

    src.graph.beginPath()
    dst.graph.beginPath()

    for (let x = -gridElementsX; x <= gridElementsX; x++) {
        src.graph.moveTo (x*resolution, -gridElementsY*resolution)
        src.graph.lineTo (x*resolution, gridElementsY*resolution)
    }
    for (let y = -gridElementsY; y <= gridElementsY; y++) {
        src.graph.moveTo (-gridElementsX*resolution, y*resolution)
        src.graph.lineTo (gridElementsX*resolution, y*resolution)
    }
    for (let x = -gridElementsX; x <= gridElementsX; x++) {
        const z = complex (x*resolution, -gridElementsY*resolution),
        fz = state.f.evaluate({z})
        dst.graph.moveTo (fz.re, fz.im)
        for (let y = -gridElementsY*steps; y <= gridElementsY*steps; y++) {
            const z = complex (x*resolution, y*resolution/steps),
            fz = state.f.evaluate({z})
            dst.graph.lineTo (fz.re, fz.im)
        }
    }
    for (let y = -gridElementsY; y <= gridElementsY; y++) {
        const z = complex (-gridElementsX*resolution, y*resolution),
        fz = state.f.evaluate({z})
        dst.graph.moveTo (fz.re, fz.im)
        for (let x = -gridElementsX*steps; x <= gridElementsX*steps; x++) {
            const z = complex (x*resolution/steps, y*resolution),
            fz = state.f.evaluate({z})
            dst.graph.lineTo (fz.re, fz.im)
        }
    }
    src.graph.stroke()
    dst.graph.stroke()

    // Inputs
    if (state.inputs) {
        src.graph.beginPath ()
        state.inputs.forEach((z, i) => {
            if (z == null) {
                return
            } else if (i == 0 || state.inputs[i-1] == null) {
                src.graph.moveTo (z.re, z.im)
            } else {
                src.graph.lineTo (z.re, z.im)
            }
        })
        src.graph.stroke ()
    }
    // Outputs
    if (state.outputs) {
        dst.graph.beginPath ()
        state.outputs.forEach((fz, i) => {
            if (fz == null) {
                return
            } else if (i == 0 || state.outputs[i-1] == null) {
                dst.graph.moveTo (fz.re, fz.im)
            } else {
                dst.graph.lineTo (fz.re, fz.im)
            }
        })
        dst.graph.stroke ()
    }

    composite ()
}

function drawGraphLast ()
{
    if (state.inputs.length < 2)
        return

    setTransform ()
    const z1 = state.inputs[state.inputs.length-2],
    z2 = state.inputs[state.inputs.length-1],
    fz1 = state.outputs[state.outputs.length-2],
    fz2 = state.outputs[state.outputs.length-1]

    if (z1 != null && z2 != null) {
        src.graph.beginPath ()
        src.graph.moveTo (z1.re, z1.im)
        src.graph.lineTo (z2.re, z2.im)
        src.graph.stroke ()
    }
    if (fz1 != null && fz2 != null) {
        dst.graph.beginPath ()
        dst.graph.moveTo (fz1.re, fz1.im)
        dst.graph.lineTo (fz2.re, fz2.im)
        dst.graph.stroke ()
    }

    composite ()
}

function composite () {
    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    dstWidth = dst.graph.canvas.width,
    dstHeight = dst.graph.canvas.height

    src.comp.setTransform(1, 0, 0, 1, 0, 0)
    dst.comp.setTransform(1, 0, 0, 1, 0, 0)
    src.comp.clearRect (0, 0, srcWidth, srcHeight)
    dst.comp.clearRect (0, 0, dstWidth, dstHeight)

    src.comp.drawImage (src.graph.canvas, 0, 0)
    dst.comp.drawImage (dst.graph.canvas, 0, 0)

    setTransform ()

    if (state.derivative)
    {
        const fz1 = state.outputs[state.outputs.length - 1] as math.Complex,
        fz2 = add(fz1, state.derivative) as math.Complex,
        fz3 = add(fz1, multiply(state.derivative, complex(0, 1))) as math.Complex
        dst.comp.beginPath ()
        dst.comp.moveTo (fz1.re, fz1.im)
        dst.comp.lineTo (fz2.re, fz2.im)
        dst.comp.moveTo (fz1.re, fz1.im)
        dst.comp.lineTo (fz3.re, fz3.im)
        dst.comp.stroke ()

        const z1 = state.inputs[state.inputs.length - 1] as math.Complex,
        z2 = add(z1, complex(1, 0)) as math.Complex,
        z3 = add(z1, complex(0, 1)) as math.Complex
        src.comp.beginPath ()
        src.comp.moveTo (z1.re, z1.im)
        src.comp.lineTo (z2.re, z2.im)
        src.comp.moveTo (z1.re, z1.im)
        src.comp.lineTo (z3.re, z3.im)
        src.comp.stroke ()
    }
}


src.comp.canvas.onmousedown = (e) => {
    state.mouseDown = true
    const z = mouseToComplex (e.clientX, e.clientY)
    addInput (z)
    // Add twice to draw a dot
    addInput (z)
    drawGraphLast ()
}

src.comp.canvas.onmousemove = (e) => {
    if (!(e.buttons & 1) || !state.mouseDown) return
    const z = mouseToComplex (e.clientX, e.clientY)
    addInput (z)

    drawGraphLast ()
}

src.comp.canvas.onmouseout = (e) => {
    if (!(e.buttons & 1) || !state.mouseDown) return
    addInput (null) // Break line
}

document.body.onmousemove = (e) => {
    if (!(e.buttons & 1) && state.mouseDown) {
        // We missed a mouseUp event. Saw this happen on Firefox on Linux when
        // dragging out and releasing over Tree Style Tab.
        onMouseUp ()
    }
}
function onMouseUp () {
    state.mouseDown = false
    addInput (null) // Break line
}

window.onmouseup = onMouseUp

let resizeDebounce: number | null = null
window.onresize = () => {
    if (resizeDebounce != null)
        clearTimeout(resizeDebounce)
    resizeDebounce = setTimeout(() => {
        resizeDebounce = null
        resize ()
    }, 400)
}

function resize () {
    [src, dst].forEach((g) => {
        const bounds = g.comp.canvas.getBoundingClientRect ()
        g.comp.canvas.width = bounds.width;
        g.comp.canvas.height = bounds.height;
        g.graph.canvas.width = bounds.width;
        g.graph.canvas.height = bounds.height;
    })
    drawGraphFull ()
}

drawGraphFull ()
