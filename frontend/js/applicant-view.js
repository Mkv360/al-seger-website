function saveApplicant(data) {
  let list = JSON.parse(
    localStorage.getItem("applicants") || "[]"
  );

  list.push({
    ...data,
    id: Date.now()
  });

  localStorage.setItem(
    "applicants",
    JSON.stringify(list)
  );
}