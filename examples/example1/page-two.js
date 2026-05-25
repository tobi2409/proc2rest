const btn = document.getElementById('btn')

btn.addEventListener('click', async () => {
    const newPerson = await addPerson({
        name: 'New Person',
        age: 20
    })
    
    alert(`Added person: ${newPerson.name}, age: ${newPerson.age}`)
})