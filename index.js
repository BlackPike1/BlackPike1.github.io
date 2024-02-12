const errorContainer = document.getElementById("error");
const loginContainer = document.getElementById("login-container");
const graphsContainer = document.getElementById("app");

const error = (errorMessage) => {
    document.getElementById("error-message").innerText = errorMessage;
    errorContainer.style.display = "flex";
    loginContainer.style.display = "none";
    graphsContainer.style.display = "none";
    document.getElementById("back-home-btn").addEventListener("click", closeError);
};

const success = () => {
    errorContainer.style.display = "none";
    loginContainer.style.display = "none";
    graphsContainer.style.display = "block";
};

const closeError = () => {
    errorContainer.style.display = "none";
    loginContainer.style.display = "flex";
    document.getElementById("back-home-btn").removeEventListener("click", closeError);
};

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usernameVal = document.getElementById("identifier").value;
    const passwordVal = document.getElementById("password").value;

    try {
        const res = await fetch("https://01.kood.tech/api/auth/signin", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + btoa(`${usernameVal}:${passwordVal}`)
            }
        });

        if (res.ok) {
            const token = await res.json();
            localStorage.setItem("jwt", token);
            success();
            getData();
            const logoutButton = document.getElementById("logout");
            logoutButton.addEventListener("click", logout);
        } else {
            const errortext = await res.json();
            error(errortext.error);
        }
    } catch (err) {
        console.error(err);
        error("Error! Try again!");
    }
});

function logout() {
    localStorage.removeItem("jwt");
    loginContainer.style.display = "flex";
    graphsContainer.style.display = "none";

    const logoutButton = document.getElementById("logout");
    if (logoutButton) {
        logoutButton.style.display = "none";
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.reset();
    }
}

function getData() {
    fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("jwt")}`
        },
        body: JSON.stringify({
            query: `
                query {
                    user {
                        id
                        login
                        attrs
                        totalUp
                        totalDown
                        createdAt
                        updatedAt
                        transactions(order_by: { createdAt: asc }) {
                            id
                            createdAt
                            objectId
                            type
                            amount
                            path
                            object {
                                id
                                name
                                type
                                attrs
                            }
                        }
                    }
                }
            `
        })
    })
    .then(response => response.json())
    .then(data => {
        let levelgraph = [];
        let transactions = data.data.user[0].transactions;
        let up = data.data.user[0].totalUp;
        let down = data.data.user[0].totalDown;
        let xp = 0;
        let level = 0;
        let projects = [];
        let audits = [];

        transactions.forEach(element => {
            if (element.type === "xp" && !element.path.includes("piscine")) {
                xp += element.amount;
                projects.push(element);
                const date = new Date(element.createdAt);
                const time = date.toLocaleString("default", { month: "short", year: "2-digit" });

                if (levelgraph.length === 0) {
                    levelgraph = generateScale(time);
                }

                levelgraph.forEach(e => {
                    if (time === e.time) {
                        e.value = xp / 1000;
                    }
                });
            }

            if (element.type === "level" && element.path.includes("/johvi/div-01/")) {
                if (element.amount > level) {
                    level = element.amount;
                }
            }

            if (element.type === "up") {
                audits.push(element);
            }
        });

        const greetingElement = document.querySelector(".greeting");
        greetingElement.textContent = `Hello, ${data.data.user[0].login}`;

        const levelElement = document.getElementById("level");
        levelElement.textContent = `${level}`;

        const totalXpElement = document.getElementById("total-xp");
        totalXpElement.textContent = `Current XP: ${(xp / 1000000).toFixed(2)} MB`;

        const doneAuditElement = document.getElementById("done");
        doneAuditElement.textContent = `Done: ${(up / 1000000).toFixed(2)} MB`;

        const receivedAuditElement = document.getElementById("received");
        receivedAuditElement.textContent = `Received: ${(down / 1000000).toFixed(2)} MB`;

        const ratioAuditElement = document.getElementById("ratio");
        ratioAuditElement.textContent = `Ratio: ${(up / down).toFixed(1)}`;

        makeProgressData(levelgraph);
        makePieSlice(projects, xp);
    })
    .catch(error => {
        console.error("Error fetching data:", error);
    });
}

function generateScale(start) {
    const cur = new Date(`15 ${start}`);
    const untilDateString = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toDateString();
    const result = [];

    for (; untilDateString !== cur.toDateString(); cur.setMonth(cur.getMonth() + 1)) {
        result.push({ time: cur.toLocaleString('default', { month: 'short', year: '2-digit' }), value: 0 });
    }

    return result;
}

function makeProgressData(projects) {
    for (let i = 1; i < projects.length; i++) {
        if (projects[i].value === 0) {
            projects[i].value = projects[i - 1].value;
        }
    }

    const width = 600;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    const svg = d3.select("#xp-progression")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style('fill', 'white')
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().range([0, width]).padding(0.1);
    const y = d3.scaleLinear().range([height, 0]);

    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value));

    x.domain(projects.map(d => d.time));
    y.domain([0, Math.ceil(d3.max(projects, d => d.value) / 500) * 500]);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .style('fill', 'white')
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis")
        .style('fill', 'white')
        .call(d3.axisLeft(y));

    svg.append("text")
        .text("XP (kB)")
        .style('fill', 'white')
        .attr("x", 20)
        .attr("y", 0)
        .style("pointer-events", "none");     

    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .datum(projects)
        .attr("class", "line")
        .attr("d", line);
}

function makePieSlice(projects, xp) {
    const colors = [
        "#FF0000", "#FFFF00", "#FF1493", "#0000FF", "#00FF00", "#FFA500",
        "#FF69B4", "#00CED1", "#FF6347", "#FF4500", "#1E90FF", "#DC143C",
        "#FF8C00", "#008080", "#FA8072"
    ];
    const circumfence = 2 * Math.PI * 75;
    let start = -90;
    let colorcount = 0;
    const pie = document.getElementById("pie");
    const pieCenterX = 150;
    const pieCenterY = 150;
    const uniqueProjects = new Set();

    projects.forEach(element => {
        if (element.amount > 0 && !uniqueProjects.has(element.object.name)) {
            let slicesize = (element.amount / xp) * 360;
            let sliceradius = (element.amount / xp) * 100 * circumfence / 100;
            let info = document.getElementById("info");
            var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("class", "circle");
            circle.setAttribute("r", 75);
            circle.setAttribute("cx", pieCenterX);
            circle.setAttribute("cy", pieCenterY);
            circle.setAttribute("fill", "transparent");
            circle.setAttribute("stroke", colors[colorcount]);
            circle.setAttribute("stroke-width", 150);
            circle.setAttribute("stroke-dasharray", `${sliceradius} ${2 * Math.PI * 75}`);
            circle.setAttribute("transform", `rotate(${start} ${pieCenterX} ${pieCenterY})`);
            pie.append(circle);

            uniqueProjects.add(element.object.name);

            circle.addEventListener("mousemove", event => {
                info.style.visibility = "visible";
                info.style.position = "absolute";
                info.style.zIndex = "1";
                info.style.color = "#fff";
                info.style.backgroundColor = "black";

                let angle = start + slicesize / 2;
                let radians = (angle * Math.PI) / 180;
                let offsetX = 50 * Math.cos(radians);
                let offsetY = 50 * Math.sin(radians);

                var mouseX = event.clientX;
                var mouseY = event.clientY;
                info.style.left = mouseX + window.scrollX + offsetX + "px";
                info.style.top = mouseY + window.scrollY + offsetY + "px";
                info.innerHTML = `${element.object.name} - ${element.amount / 1000}XP (${(element.amount / xp * 100).toFixed(2)}%)`;
            });

            circle.addEventListener("mouseout", function () {
                info.style.visibility = "hidden";
            });

            start += slicesize;
            colorcount == colors.length - 1 ? colorcount = 0 : colorcount++;
        }
    });
}