const btn = document.getElementById('btn')

btn.addEventListener('click', async () => {
    await addPerson({
        name: 'New Person',
        age: 20
    })
})