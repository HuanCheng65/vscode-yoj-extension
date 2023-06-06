/* eslint-disable @typescript-eslint/naming-convention */
import fetch from "node-fetch";
import { LoggedInUser, LoginResult, Problem, ProblemDetail, ProblemType, Submission, SubmissionDetail, SubmitResult, SupportLanguage } from "./types";
import { load } from "cheerio";
import { getString, parseJson, parseString } from "./utils";

const FormData = require('form-data');

export const getLoggedInUser = (sessionId: string): Promise<LoggedInUser> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/user/detail.html', {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            }
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    const $ = load(text);
                    const pageTitle = $('title').text();
                    if (pageTitle === '个人刷题数据') {
                        const uid = $('#uidhelp').val()?.toString();
                        const username = $('div#user_card.ui.card div.content div.header').text();
                        const nickname = $('div.extra:nth-child(3)').text().trim().replace('昵称 ', '');
                        resolve({ status: true, uid, username, nickname });
                    } else {
                        resolve({ status: false, message: '未登录' });
                    }
                });
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const login = (sessionId: string, username: string, password: string): Promise<LoginResult> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/login/login2.html', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'Origin': 'http://yoj.ruc.edu.cn',
                'Referer': 'http://yoj.ruc.edu.cn/index.php/index/index/signin.html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: `username=${username}&passwd=${password}`
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    resolve(parseJson(text));
                });
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

const parseSubmissions = (html: string): Array<Submission> => {
    const $ = load(html);
    const submissions: Array<Submission> = [];
    $('tbody tr').each((_, element) => {
        const submission: Submission = {
            id: parseInt(parseString($(element).children('td:nth-child(1)').text()).replace('#', '')),
            problemId: parseInt(parseString($(element).children('td:nth-child(2)').text()).split(' ')[0].replace('#', '')),
            problemName: parseString($(element).children('td:nth-child(2)').text()).split(' ')[1],
            status: parseString($(element).children('td:nth-child(3)').text()),
            score: parseInt($(element).children('td:nth-child(4)').text().trim()),
            runTime: parseString($(element).children('td:nth-child(5)').text()),
            memory: parseString($(element).children('td:nth-child(6)').text()),
            language: parseString($(element).children('td:nth-child(7)').text()).split('/')[0].trim(),
            codeLength: parseString($(element).children('td:nth-child(7)').text()).split('/')[1].trim(),
            submitter: parseString($(element).children('td:nth-child(8)').text()),
            submitTime: parseString($(element).children('td:nth-child(9)').text()),
        };
        submissions.push(submission);
    });
    return submissions;
};


export const getSubmissionList = (sessionId: string, page: number): Promise<Array<Submission>> => {
    return new Promise((resolve, reject) => {
        fetch(`http://yoj.ruc.edu.cn/index.php/submissions/index/p/${page}.html`, {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            }
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    resolve(parseSubmissions(text));
                });
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const getSubmissionDetail = (sessionId: string, submissionId: number): Promise<SubmissionDetail> => {
    return new Promise((resolve, reject) => {
        fetch(`http://yoj.ruc.edu.cn/index.php/index/submissions/detail/subno/${submissionId}.html`, {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            }
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    const submission = parseSubmissions(text)[0];
                    const submissionDetail: SubmissionDetail = {
                        submission,
                    };
                    resolve(submissionDetail);
                });
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const getProblemList = (sessionId: string): Promise<Array<Problem>> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/problem/index.html', {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            }
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    const $ = load(text);
                    const problems: Array<Problem> = [];
                    $('tbody tr').each((_, element) => {
                        const problem: Problem = {
                            id: parseInt(parseString($(element).children('td:nth-child(1)').text())),
                            name: parseString($(element).children('td:nth-child(2)').text()),
                            difficulty: parseInt(parseString($(element).children('td:nth-child(3)').text())),
                            keywords: parseString($(element).children('td:nth-child(4)').text()),
                        };
                        problems.push(problem);
                    });
                    resolve(problems);
                });
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const getFillCodeTemplate = (sessionId: string, problemId: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/problem/gettkcode.html', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'Origin': 'http://yoj.ruc.edu.cn',
                'Referer': `http://yoj.ruc.edu.cn/index.php/index/problem/detailtk/pno/${problemId}.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: `pno=${problemId}`
        }).then(res => {
            if (res.status === 200) {
                res.text().then(text => {
                    const json = parseJson(text);
                    if (json.status === 1) {
                        resolve(json.content);
                    } else {
                        reject(json.info);
                    }
                });
            } else {
                reject(`HTTP ${res.status
                    }`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const getProblemDetail = (sessionId: string, problemId: number): Promise<ProblemDetail> => {
    return new Promise((resolve, reject) => {
        fetch(`http://yoj.ruc.edu.cn/index.php/index/problem/detail/pno/${problemId}.html`, {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            }
        }).then(res => {
            if (res.status === 200) {
                let problemType = res.url.includes('detailtk') ? ProblemType.FillInTheBlank : ProblemType.Normal;
                res.text().then(text => {
                    const $ = load(text);
                    const problemDetail: ProblemDetail = {
                        id: problemId,
                        name: parseString($('h1').text()).split(' ')[1].trim(),
                        type: problemType,
                        descriptionHtml: parseString($('#p_content').html() || ""),
                        descriptionText: getString($('#p_content').html() || ""),
                        memoryLimit: parseString($('div.center:nth-child(6) > div:nth-child(2) > span:nth-child(1)').text()).split("：")[1].trim(),
                        timeLimit: parseString($('div.center:nth-child(6) > div:nth-child(2) > span:nth-child(2)').text()).split("：")[1].trim(),
                        uploader: parseString($('div.ui:nth-child(6) > div:nth-child(4) > span:nth-child(1)').text()).split("：")[1].trim(),
                    };
                    if (problemType === ProblemType.Normal) {
                        const languages: Array<SupportLanguage> = [];
                        $('#languages-menu > a').each((_, element) => {
                            let name = parseString($(element).text());
                            const value = parseString($(element).attr('data-value')!);
                            const mode = parseString($(element).attr('data-mode')!);
                            const extension = parseString($(element).find('div').text());
                            name = name.replace(extension, '').trim();
                            languages.push({
                                name,
                                value,
                                mode,
                                extension,
                            });
                        });
                        problemDetail.supportLanguages = languages;
                        resolve(problemDetail);
                    } else {
                        problemDetail.descriptionHtml = parseString($('.segment.font-content').html() || "");
                        problemDetail.descriptionText = getString(problemDetail.descriptionHtml);
                        getFillCodeTemplate(sessionId, problemId).then(template => {
                            let content = template;
                            problemDetail.codeTemplate = template;
                            let blankCount = 0;
                            while (content.trim()) {
                                let index = content.indexOf("____qcodep____");
                                if (index < 0) {
                                    break;
                                }
                                blankCount += 1;
                                content = content.substring(index + "____qcodep____".length);
                            }
                            problemDetail.blankCount = blankCount;
                            problemDetail.useCompiler = $('#compiler_select').val() as string;
                            resolve(problemDetail);
                        }).catch(err => {
                            reject(err);
                        });
                    }
                });
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const submitProblem = (sessionId: string, problemId: number, language: string, code: string): Promise<SubmitResult> => {
    return new Promise((resolve, reject) => {
        let formData = new FormData();
        formData.append('language', language);
        formData.append('code', code);
        formData.append('pid', problemId.toString());
        formData.append('answer', '', '');
        fetch('http://yoj.ruc.edu.cn/index.php/index/index/prob_submit.html', {
            method: 'POST',
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'Origin': 'http://yoj.ruc.edu.cn',
                'Referer': `http://yoj.ruc.edu.cn/index.php/index/problem/detail/pno/${problemId}.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: formData
        }).then(res => {
            if (res.status === 200) {
                if (res.url === 'http://yoj.ruc.edu.cn/index.php/index/submissions/index.html') {
                    res.text().then(text => {
                        const submission = parseSubmissions(text)[0];
                        resolve({ status: 1, submissionId: submission.id });
                    });
                    return;
                }
                // TODO: handle error
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};

export const submitProblemFill = (sessionId: string, problemId: number, compiler: string, codes: Array<string>): Promise<SubmitResult> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/index/prob_submit_tk.html', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'Origin': 'http://yoj.ruc.edu.cn',
                'Referer': `http://yoj.ruc.edu.cn/index.php/index/problem/detailtk/pno/${problemId}.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: `pno=${problemId}&codes=${encodeURIComponent(JSON.stringify(codes))}&compiler=${compiler}`
        }).then(res => {
            res.text().then(text => {
                const json = parseJson(text);
                if (json.status === 1) {
                    resolve({ status: 1, submissionId: json.sid });
                } else {
                    resolve({ status: json.status, info: json.info });
                }
            }).catch(err => {
                reject(err);
            });
        }).catch(err => {
            reject(err);
        });
    });
};

export const logout = (sessionId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fetch('http://yoj.ruc.edu.cn/index.php/index/login/logout.html', {
            headers: {
                'Cookie': `uid=${sessionId}`,
                'Host': 'yoj.ruc.edu.cn',
                'Referer': 'http://yoj.ruc.edu.cn/index.php/index/index/index.html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
            },
        }).then(res => {
            if (res.status === 200) {
                resolve();
            } else {
                reject(`HTTP ${res.status}`);
            }
        }).catch(err => {
            reject(err);
        });
    });
};