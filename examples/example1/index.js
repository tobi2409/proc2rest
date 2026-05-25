const btn = document.getElementById('btn')

btn.addEventListener('click', async () => {
    const result = (await getPerson('Jane Doe'))

    for (const entry of result) {
        alert(`${entry.name} is ${entry.age} years old.`)
    }
})

const btn2 = document.getElementById('btn2')

btn2.addEventListener('click', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const binDataInfo = await pgetBinDataInfo('mydata', data)
    alert(`Bin Data Info: ${binDataInfo}`)
})

const btn4 = document.getElementById('btn4')
const btn5 = document.getElementById('btn5')

btn4.addEventListener('click', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const reversed = await reverseBytes(data)
    alert(`Original: [${data}]\nReversed: [${reversed}]`)
})

btn5.addEventListener('click', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const result = await reverseBytesWithName('mydata', data)
    alert(`Name: ${result.name}\nOriginal: [${data}]\nReversed: [${result.reversed}]`)
})

const fileInput = document.getElementById('fileInput')
const btn3 = document.getElementById('btn3')

btn3.addEventListener('click', async () => {
    if (!fileInput.files.length) {
        alert('Please select a file')
        return
    }

    const file = fileInput.files[0]
    console.log(`Selected file: ${file.name}, size: ${file.size} bytes`)

    try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        console.log(`File converted to Uint8Array: ${uint8Array.byteLength} bytes`)
        console.log('Uint8Array:', uint8Array)

        // Call the API with the file data
        const result = await pgetBinDataInfo(file.name, uint8Array)
        console.log(`Result: ${result}`)
        alert(`File uploaded: ${result}`)
    } catch (error) {
        console.error('File upload error:', error)
        alert(`Error: ${error.message}`)
    }
})