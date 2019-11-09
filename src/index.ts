import {parse, derivative, complex, add, multiply} from "mathjs"

//////////////////// STATE ////////////////////

interface State {
    fRaw: string
    // Derived from fRaw
    f: math.EvalFunction
    df: math.EvalFunction

    inputs: (math.Complex | null)[]
    // Derived from inputs and fRaw
    outputs: (math.Complex | null)[]

    mouseZ: math.Complex | null
    // Derived from mouseZ and df
    mouseFz: math.Complex | null
    mouseDz: math.Complex | null

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
        mouseZ: null,
        mouseFz: null,
        mouseDz: null,
        scaleSrc, scaleDst,
        mouseDown: false,
    }
}

const state: State = initState ("e^z", 5, 50)

const funcForm = document.getElementById ("func-form") as HTMLFormElement,
funcText = document.getElementById ("func") as HTMLInputElement,
srcZoomPlus = document.querySelector ("#zoom-src .p") as HTMLButtonElement,
srcZoomMinus= document.querySelector ("#zoom-src .m") as HTMLButtonElement,
dstZoomPlus = document.querySelector ("#zoom-dst .p") as HTMLButtonElement,
dstZoomMinus= document.querySelector ("#zoom-dst .m") as HTMLButtonElement,
clear = document.getElementById ("clear") as HTMLButtonElement

funcText.value = state.fRaw
funcForm.onsubmit = (e) => {
    e.preventDefault ()
    if (funcText.value == state.fRaw) return

    state.fRaw = funcText.value

    const f = parse(state.fRaw)
    state.f = f.compile ()
    state.df = derivative (f, "z").compile ()

    state.outputs = state.inputs.map ((z) => {
        if (z == null) return null
        return state.f.evaluate ({z})
    })

    if (state.mouseZ) {
        state.mouseFz = state.f.evaluate ({z: state.mouseZ})
        state.mouseDz = state.df.evaluate ({z: state.mouseZ})
    }

    drawGraphFull ()
}

const SCALE = 1.3
srcZoomPlus.onclick = () => {
    state.scaleSrc /= SCALE
    drawGraphFull ()
}
srcZoomMinus.onclick = () => {
    state.scaleSrc *= SCALE
    drawGraphFull ()
}
dstZoomPlus.onclick = () => {
    state.scaleDst /= SCALE
    drawGraphFull ()
}
dstZoomMinus.onclick = () => {
    state.scaleDst *= SCALE
    drawGraphFull ()
}

clear.onclick = () => {
    state.inputs = []
    state.outputs = []
    drawGraphFull ()
}

function addInput (z: math.Complex | null) {
    if (z == null) {
        state.inputs.push (null)
        state.outputs.push (null)
        return
    }
    const fz = state.f.evaluate ({z})
    state.inputs.push (z)
    state.outputs.push (fz)
}

function setMouse (z: math.Complex | null) {
    state.mouseZ = z
    if (!z) return

    state.mouseFz = state.f.evaluate ({z})
    state.mouseDz = state.df.evaluate ({z})
}

//////////////////// GRAPHICS ////////////////////

interface Graph {
    comp: CanvasRenderingContext2D
    graph: CanvasRenderingContext2D
}

interface Style {
    style: string
    width: number
}

function style(style: string, width: number): Style {
    return {style, width}
}

const STYLE = {
    axis: style("#555", 1),
    grid: style("#CCC", 1),
    line: style("black", 2),
    dUp: style("red", 3),
    dRight: style("green", 3),
}

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
    const bounds = src.comp.canvas.getBoundingClientRect()

    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    srcOffsetX = (srcWidth >> 1) + bounds.x,
    srcOffsetY = (srcHeight >> 1) + bounds.y,
    srcScale = srcWidth / state.scaleSrc

    return complex((x-srcOffsetX) / srcScale, (y-srcOffsetY) / -srcScale)
}

function setTransform () {
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
}

function setStyle (s: Style) {
    const srcWidth = src.graph.canvas.width,
    dstWidth = dst.graph.canvas.width,
    srcScale = srcWidth / state.scaleSrc,
    dstScale = dstWidth / state.scaleDst;

    [src.comp, src.graph, dst.comp, dst.graph].forEach((ctx) => {
        ctx.strokeStyle = s.style
    })
    src.comp.lineWidth = s.width / srcScale
    src.graph.lineWidth = s.width / srcScale
    dst.comp.lineWidth = s.width / dstScale
    dst.graph.lineWidth = s.width / dstScale
}

function drawGraphFull () {
    if (!validateSize ()) return

    const srcWidth = src.graph.canvas.width,
    srcHeight = src.graph.canvas.height,
    dstWidth = dst.graph.canvas.width,
    dstHeight = dst.graph.canvas.height,
    srcScale = srcWidth / state.scaleSrc,
    dstScale = dstWidth / state.scaleDst

    src.graph.setTransform(1, 0, 0, 1, 0, 0)
    dst.graph.setTransform(1, 0, 0, 1, 0, 0)
    src.graph.clearRect (0, 0, srcWidth, srcHeight)
    dst.graph.clearRect (0, 0, dstWidth, dstHeight)

    setTransform ()

    // Grid
    setStyle(STYLE.grid)
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

    // Axis
    setStyle(STYLE.axis)
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


    // Inputs
    setStyle(STYLE.line)
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
    if (!validateSize ()) return
    if (state.inputs.length < 2) return

    setTransform ()
    setStyle(STYLE.line)
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
    if (!validateSize ()) return

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

    if (state.mouseZ && state.mouseFz && state.mouseDz)
    {
        const z = state.mouseZ,
        z2 = add(z, complex(1, 0)) as math.Complex,
        z3 = add(z, complex(0, 1)) as math.Complex
        const fz1 = state.mouseFz,
        fz2 = add(fz1, state.mouseDz) as math.Complex,
        fz3 = add(fz1, multiply(state.mouseDz, complex(0, 1))) as math.Complex

        setStyle(STYLE.dUp)
        src.comp.beginPath ()
        src.comp.moveTo (z.re, z.im)
        src.comp.lineTo (z2.re, z2.im)
        src.comp.stroke ()
        dst.comp.beginPath ()
        dst.comp.moveTo (fz1.re, fz1.im)
        dst.comp.lineTo (fz2.re, fz2.im)
        dst.comp.stroke ()

        setStyle(STYLE.dRight)
        src.comp.beginPath ()
        src.comp.moveTo (z.re, z.im)
        src.comp.lineTo (z3.re, z3.im)
        src.comp.stroke ()
        dst.comp.beginPath ()
        dst.comp.moveTo (fz1.re, fz1.im)
        dst.comp.lineTo (fz3.re, fz3.im)
        dst.comp.stroke ()

    }
}

function validateSize (): boolean {
    const bounds = src.comp.canvas.getBoundingClientRect ()
    if (src.comp.canvas.width == Math.floor(bounds.width) &&
        src.comp.canvas.height == Math.floor(bounds.height))
        return true

    resize ()
    return false // Stop rendering
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
    const z = mouseToComplex (e.clientX, e.clientY)

    if (!(e.buttons & 1)) {
        setMouse (z)

        composite ()
    } else if (state.mouseDown) {
        addInput (z)

        drawGraphLast ()
    }
}

src.comp.canvas.onmouseout = (e) => {
    if (!(e.buttons & 1) || !state.mouseDown) {
        state.mouseZ = null
        composite ()
        return
    }
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
    }, 100)
}

function resize () {
    [src, dst].forEach((g) => {
        const bounds = g.comp.canvas.getBoundingClientRect ()
        g.comp.canvas.width = bounds.width;
        g.comp.canvas.height = bounds.height;
        g.graph.canvas.width = bounds.width;
        g.graph.canvas.height = bounds.height;
    })
    requestAnimationFrame (drawGraphFull)
}

drawGraphFull ()
