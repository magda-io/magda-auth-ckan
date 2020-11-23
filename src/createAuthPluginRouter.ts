import express, { Router } from "express";
import { Authenticator } from "passport";
import { default as ApiClient } from "@magda/auth-api-client";
import { Strategy as LocalStrategy } from "passport-local";
import loginToCkan from "./loginToCkan";
import {
    createOrGetUserToken,
    redirectOnSuccess,
    redirectOnError,
    getAbsoluteUrl
} from "@magda/authentication-plugin-sdk";

export interface AuthPluginRouterOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    externalUrl: string;
    authPluginRedirectUrl: string;
    // ckan site base url
    ckanUrl: string;
}

export default function createAuthPluginRouter(
    options: AuthPluginRouterOptions
): Router {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const ckanUrl = options.ckanUrl;
    const externalUrl = options.externalUrl;
    const resultRedirectionUrl = getAbsoluteUrl(
        options.authPluginRedirectUrl,
        externalUrl
    );

    if (!ckanUrl) {
        throw new Error("Required parameter ckanUrl can't be empty!");
    }

    const router: express.Router = express.Router();

    // LocalStrategy requires `body-parser` middleware to work
    router.use(require("body-parser").urlencoded({ extended: true }));

    passport.use(
        "ckan-local",
        new LocalStrategy(
            async (
                username: string,
                password: string,
                cb: (error: any, user?: any, info?: any) => void
            ) => {
                try {
                    const profile = await loginToCkan(
                        username,
                        password,
                        ckanUrl
                    );

                    const sessionData = await createOrGetUserToken(
                        authorizationApi,
                        profile,
                        "ckan"
                    );

                    cb(null, sessionData);
                } catch (e) {
                    console.log("Login failed: " + e);
                    cb(e);
                }
            }
        )
    );

    router.get("/", function (req, res) {
        // redirect users according to [spec document](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md)
        const runtimeRedirectUrl =
            typeof req?.query?.redirect === "string" && req.query.redirect
                ? getAbsoluteUrl(req.query.redirect, externalUrl)
                : resultRedirectionUrl;

        if (req?.user?.id) {
            redirectOnSuccess(runtimeRedirectUrl, req, res);
        } else {
            redirectOnError("unauthorized", runtimeRedirectUrl, req, res);
        }
    });

    router.post(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("ckan-local", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(resultRedirectionUrl, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            redirectOnError(err, resultRedirectionUrl, req, res);
        }
    );

    return router;
}
