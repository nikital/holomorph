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

    return complex((x-srcOffsetX) / srcScale, (y-srcOffsetY) / srcScale)
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

function drawGraphFull () {
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

    // Clear
    src.graph.clearRect (0, 0, srcWidth, srcHeight)
    dst.graph.clearRect (0, 0, dstWidth, dstWidth)

    // Axis
    src.graph.beginPath ()
    src.graph.moveTo (0, srcOffsetY)
    src.graph.lineTo (srcWidth, srcOffsetY)
    src.graph.moveTo (srcOffsetX, 0)
    src.graph.lineTo (srcOffsetX, srcHeight)
    src.graph.stroke ()

    dst.graph.beginPath ()
    dst.graph.moveTo (0, dstOffsetY)
    dst.graph.lineTo (dstWidth, dstOffsetY)
    dst.graph.moveTo (dstOffsetX, 0)
    dst.graph.lineTo (dstOffsetX, dstHeight)
    dst.graph.stroke ()

    // Grid
    const gridStart = -1,
    gridEnd = 1,
    step = 0.1

    src.graph.beginPath()
    dst.graph.beginPath()

    for (let x = gridStart; x < gridEnd; x += step) {
        const z = complex (x, gridStart),
        fz = state.f.evaluate({z})
        src.graph.moveTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
        dst.graph.moveTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
        for (let y = gridStart + step; y < gridEnd; y += step) {
            const z = complex (x, y),
            fz = state.f.evaluate({z})
            src.graph.lineTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
            dst.graph.lineTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
        }
    }
    for (let y = gridStart; y < gridEnd; y += step) {
        const z = complex (gridStart, y),
        fz = state.f.evaluate({z})
        src.graph.moveTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
        dst.graph.moveTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
        for (let x = gridStart + step; x < gridEnd; x += step) {
            const z = complex (x, y),
            fz = state.f.evaluate({z})
            src.graph.lineTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
            dst.graph.lineTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
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
                src.graph.moveTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
            } else {
                src.graph.lineTo (z.re * srcScale + srcOffsetX, z.im * srcScale + srcOffsetY)
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
                dst.graph.moveTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
            } else {
                dst.graph.lineTo (fz.re * dstScale + dstOffsetX, fz.im * dstScale + dstOffsetY)
            }
        })
        dst.graph.stroke ()
    }

    composite ()
}

function drawGraphLast ()
{
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

    if (state.inputs.length < 2)
        return
    const z1 = state.inputs[state.inputs.length-2],
    z2 = state.inputs[state.inputs.length-1],
    fz1 = state.outputs[state.outputs.length-2],
    fz2 = state.outputs[state.outputs.length-1]

    if (z1 != null && z2 != null) {
        src.graph.beginPath ()
        src.graph.moveTo (z1.re * srcScale + srcOffsetX, z1.im * srcScale + srcOffsetY)
        src.graph.lineTo (z2.re * srcScale + srcOffsetX, z2.im * srcScale + srcOffsetY)
        src.graph.stroke ()
    }
    if (fz1 != null && fz2 != null) {
        dst.graph.beginPath ()
        dst.graph.moveTo (fz1.re * dstScale + dstOffsetX, fz1.im * dstScale + dstOffsetY)
        dst.graph.lineTo (fz2.re * dstScale + dstOffsetX, fz2.im * dstScale + dstOffsetY)
        dst.graph.stroke ()
    }

    composite ()
}

function composite () {
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

    src.comp.clearRect (0, 0, srcWidth, srcHeight)
    src.comp.drawImage (src.graph.canvas, 0, 0)
    dst.comp.clearRect (0, 0, dstWidth, dstHeight)
    dst.comp.drawImage (dst.graph.canvas, 0, 0)

    if (state.derivative)
    {
        const fz1 = state.outputs[state.outputs.length - 1] as math.Complex,
        fz2 = add(fz1, state.derivative) as math.Complex,
        fz3 = add(fz1, multiply(state.derivative, complex(0, 1))) as math.Complex
        dst.comp.beginPath ()
        dst.comp.moveTo (fz1.re * dstScale + dstOffsetX, fz1.im * dstScale + dstOffsetY)
        dst.comp.lineTo (fz2.re * dstScale + dstOffsetX, fz2.im * dstScale + dstOffsetY)
        dst.comp.moveTo (fz1.re * dstScale + dstOffsetX, fz1.im * dstScale + dstOffsetY)
        dst.comp.lineTo (fz3.re * dstScale + dstOffsetX, fz3.im * dstScale + dstOffsetY)
        dst.comp.stroke ()

        const z1 = state.inputs[state.inputs.length - 1] as math.Complex,
        z2 = add(z1, complex(1, 0)) as math.Complex,
        z3 = add(z1, complex(0, 1)) as math.Complex
        src.comp.beginPath ()
        src.comp.moveTo (z1.re * srcScale + srcOffsetX, z1.im * srcScale + srcOffsetY)
        src.comp.lineTo (z2.re * srcScale + srcOffsetX, z2.im * srcScale + srcOffsetY)
        src.comp.moveTo (z1.re * srcScale + srcOffsetX, z1.im * srcScale + srcOffsetY)
        src.comp.lineTo (z3.re * srcScale + srcOffsetX, z3.im * srcScale + srcOffsetY)
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
