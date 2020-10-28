require("isomorphic-fetch");
require("isomorphic-form-data");

import urijs from "urijs";

const cheerio = require("cheerio");
const gravatar = require("gravatar");

async function loginToCkan(
    username: string,
    password: string,
    ckanUrl: string
) {
    const res = await fetch(
        urijs(ckanUrl)
            .segmentCoded("/login_generic")
            .search({
                came_from: "/user/logged_in"
            })
            .toString(),
        {
            method: "POST",
            redirect: "manual",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `login=${username}&password=${password}`
        }
    );

    const cookies = res.headers.get("set-cookie");

    if (!cookies) {
        console.log(
            `Failed to retrieve cookie when authenticate user: ${username}`
        );
        throw new Error("unauthorized");
    }

    const relevantCookie = cookies.split(";")[0];

    return await afterLoginSuccess(relevantCookie, username, ckanUrl);
}

async function afterLoginSuccess(
    cookies: string,
    username: string,
    ckanUrl: string
) {
    const res = await fetch(
        urijs(ckanUrl)
            .segmentCoded("/user/edit")
            .segmentCoded(`/${username}`)
            .toString(),
        {
            headers: {
                cookie: cookies
            }
        }
    );

    if (res.status === 200) {
        try {
            return await parseUser(res);
        } catch (e) {
            console.log(
                `Failed to parser user profile page for user: ${username}`
            );
            throw new Error("unauthorized");
        }
    } else {
        console.log(`Failed to access user profile page for user: ${username}`);
        throw new Error("unauthorized");
    }
}

async function parseUser(res: Response) {
    const text = await res.text();

    const $ = cheerio.load(text);

    const userName = $("#field-username").attr("value");
    const email = $("#field-email").attr("value");
    const displayName = $("#field-fullname").attr("value");

    return {
        id: userName,
        provider: "ckan",
        displayName,
        emails: [{ value: email }],
        photos: [{ value: gravatar.url(email) }]
    };
}

export default loginToCkan;
