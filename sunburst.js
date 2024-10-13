function _chart(d3, data) {
  // Specify the chart's dimensions.
let width = Math.min(window.innerWidth, window.innerHeight) * 0.8;
let height = width;
let radius = width / 9;

  // Create the color scale with richer colors
  const richerColors = [
    "#FF9AA2", // Rich coral
    "#A8D8B9", // Rich sage
    "#8AC6D1", // Rich sky blue
    "#FFDAC1", // Rich peach
    "#E2F0CB", // Rich lime
    "#B5EAD7", // Rich mint
    "#C7CEEA", // Rich periwinkle
    "#F6D5E5", // Rich rose
    "#FFE5B4", // Rich cream
    "#D4A5A5"  // Rich mauve
  ];

  const darkerColors = [
    "#8B3A1E", "#A18860", "#A99585", "#517666", "#005D5D",
    "#5A6D90", "#688092", "#809D95", "#96A39C"
  ];

  let color = d3.scaleOrdinal()
    .domain(data.children.map(d => d.name))
    .range(richerColors);

  // Compute the layout.
  const hierarchy = d3
    .hierarchy(data)
    .sum((d) => d.value)
    .sort((a, b) => b.value - a.value);
  const root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(
    hierarchy
  );
  root.each((d) => (d.current = d));

  // Create the arc generator.
  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));

  // Create the SVG container.
  const svg = d3
    .create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, width])
    .style("font-family", "'Poppins', sans-serif")
    .attr(
      "style",
      `max-width: 100%; height: auto; display: block; margin: 0 -8px; background: #191919; cursor: pointer; font-family: 'Poppins', sans-serif;`
    );

  // Append the arcs.
  const path = svg
    .append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", (d) =>
      arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
    )
    .attr("pointer-events", (d) => (arcVisible(d.current) ? "auto" : "none"))
    .attr("d", (d) => arc(d.current));

  // Make them clickable if they have children.
  path
    .filter((d) => d.children)
    .style("cursor", "pointer")
    .on("click", clicked);

  // Function to calculate font size
  function calculateFontSize(d) {
    const node = d.current;
    const angle = node.x1 - node.x0;
    const radius = (node.y0 + node.y1) / 2;
    const circumference = angle * radius;
    const maxFontSize = Math.min(12, circumference / 4);
    const minFontSize = 8;
    return Math.max(minFontSize, maxFontSize);
  }

  // Function to insert line breaks
  function insertLineBreaks(text) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length + 1 <= 10) {
        currentLine += " " + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
    return lines;
  }

  const label = svg
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
    .attr("dy", "0.35em")
    .attr("fill-opacity", (d) => +labelVisible(d.current))
    .attr("transform", (d) => labelTransform(d.current))
    .style("font-size", (d) => `${calculateFontSize(d)}px`)
    .each(function(d) {
      const lines = insertLineBreaks(d.data.name);
      d3.select(this).selectAll("tspan")
        .data(lines)
        .join("tspan")
        .attr("x", 0)
        .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
        .text(d => d);
    });

  const parent = svg
    .append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

  // Add tooltip to the center circle
  const tooltipG = svg.append("g")
    .attr("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", () => clicked(null, parent.datum()));

  const tooltipRect = tooltipG.append("rect")
    .attr("x", -40)
    .attr("y", -10)
    .attr("width", 80)
    .attr("height", 20)
    .attr("fill", "#f6f6f6")
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("fill-opacity", 0);

  const tooltipText = tooltipG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", "7px")
    .attr("fill-opacity", 0)
    .text("Go to previous layer");

  parent
    .on("mouseover", () => {
      tooltipRect.attr("fill-opacity", 0.5);
      tooltipText.attr("fill-opacity", 0.5);
    })
    .on("mouseout", () => {
      tooltipRect.attr("fill-opacity", 0);
      tooltipText.attr("fill-opacity", 0);
    });

  // Handle zoom on click.
  function clicked(event, p) {
    parent.datum(p.parent || root);

    root.each(
      (d) =>
        (d.target = {
          x0:
            Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          x1:
            Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth)
        })
    );

    const t = svg.transition().duration(750);

    // Transition the data on all arcs, even the ones that aren't visible,
    // so that if this transition is interrupted, entering arcs will start
    // the next transition from the desired position.
    path
      .transition(t)
      .tween("data", (d) => {
        const i = d3.interpolate(d.current, d.target);
        return (t) => (d.current = i(t));
      })
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", (d) =>
        arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
      )
      .attr("pointer-events", (d) => (arcVisible(d.target) ? "auto" : "none"))
      .attrTween("d", (d) => () => arc(d.current));

    label
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      })
      .transition(t)
      .attr("fill-opacity", (d) => +labelVisible(d.target))
      .attrTween("transform", (d) => () => labelTransform(d.current))
      .tween("text", function(d) {
        const i = d3.interpolate(d.current, d.target);
        return function(t) {
          d.current = i(t);
          const fontSize = calculateFontSize(d);
          d3.select(this)
            .style("font-size", `${fontSize}px`)
            .attr("transform", labelTransform(d.current));
          
          const lines = insertLineBreaks(d.data.name);
          d3.select(this).selectAll("tspan")
            .data(lines)
            .join("tspan")
            .attr("x", 0)
            .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
            .text(d => d);
        };
      });
  }

  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${-x + 90})`;
  }

// Dark mode toggle functionality
  function updateColors(isLightMode) {
    const textColor = isLightMode ? 'black' : 'white';
    const backgroundColor = isLightMode ? '#fff' : '#191919';
    
    color.range(isLightMode ? richerColors : darkerColors);

    svg.attr("style", `max-width: 100%; height: auto; display: block; margin: 0 -8px; background: ${backgroundColor}; cursor: pointer; font-family: 'Poppins', sans-serif;`);

    path.attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    });

    label.attr("fill", textColor);
    tooltipText.attr("fill", textColor);
    tooltipRect.attr("fill", isLightMode ? "#f6f6f6" : "#333");

    // Update logo
    const logo = document.getElementById('logo');
    if (logo) {
      logo.src = isLightMode ? 'logo.png' : 'dark-logo.png';
    }

    // Update toggle button text
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.textContent = isLightMode ? "Dark Mode" : "Light Mode";
    }
  }

  // Set up event listener for dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      const isLightMode = document.body.classList.toggle('light-mode');
      updateColors(isLightMode);
    });
  }

  // Initialize with dark mode
  updateColors(false);

  return svg.node();
}

function _data(FileAttachment) {
  return FileAttachment("data.json").json();
}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["data.json", {url: new URL("./data/data.json", import.meta.url), mimeType: "application/json", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer("chart")).define("chart", ["d3","data"], _chart);
  main.variable(observer("data")).define("data", ["FileAttachment"], _data);
  return main;
}
