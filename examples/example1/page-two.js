const btn = document.getElementById('btn')

btn.addEventListener('click', async () => {
    await getPerson('Jane Doe')
})