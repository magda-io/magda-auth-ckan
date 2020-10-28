import nodeFetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import urijs from "urijs";
import toughCookie from "tough-cookie";

const cheerio = require("cheerio");
const gravatar = require("gravatar");

async function loginToCkan(
    username: string,
    password: string,
    ckanUrl: string
) {
    const cookieJar = new toughCookie.CookieJar();
    const fetch = fetchCookie(nodeFetch, cookieJar);
    const res = await fetch(
        urijs(ckanUrl)
            .segmentCoded("login_generic")
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

    if(res.status === 302){
        const redirectionUrl = res.headers.get("location");
        await fetch(redirectionUrl);
    }

    return await afterLoginSuccess(fetch, username, ckanUrl);
}

async function afterLoginSuccess(
    fetch: Function,
    username: string,
    ckanUrl: string
) {
    const res = await fetch(
        urijs(ckanUrl)
            .segmentCoded("user")
            .segmentCoded("edit")
            .segmentCoded(`${username}`)
            .toString()
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
