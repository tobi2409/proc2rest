const btn = document.getElementById('btn')

btn.addEventListener('click', async () => {
    await addPerson({
        name: 'New Person',
        age: 20
    })
})

const btn2 = document.getElementById('btn2')

btn2.addEventListener('click', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const byteCount = await countBytes(data)
    console.log(`Byte count: ${byteCount}`)
})