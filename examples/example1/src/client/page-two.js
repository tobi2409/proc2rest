// @server-import first/my-server.ts
// @server-import second/pathtest/second-module.ts

const btn = document.getElementById("btn");

btn.addEventListener("click", async () => {
    const newPerson = await myServer.addPerson({
        name: "New Person",
        age: 20,
    });

    alert(`Added person: ${newPerson.name}, age: ${newPerson.age}`);
});

const btn2 = document.getElementById("btn2");

btn2.addEventListener("click", async () => {
    const person = await secondModule.getPerson();

    alert(`Got person from second module: ${person}`);
});
